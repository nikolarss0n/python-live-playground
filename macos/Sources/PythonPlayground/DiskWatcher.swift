import Darwin
import Foundation

/// Watches either an opened `.py` file or an opened project folder for external edits on disk.
/// Watches directories as well as files so atomic saves (temp file + rename) are always caught.
@MainActor
final class DiskWatcher {
    private var sources: [DispatchSourceFileSystemObject] = []
    private var pending: DispatchWorkItem?
    private var handler: (@MainActor () -> Void)?

    deinit {
        // Sources hold open file descriptors; close them if the watcher is released while active.
        for source in sources { source.cancel() }
    }

    func stop() {
        pending?.cancel()
        pending = nil
        for source in sources { source.cancel() }
        sources = []
        handler = nil
    }

    func watchFile(_ url: URL, onChange: @escaping @MainActor () -> Void) {
        stop()
        handler = onChange
        // Watch the parent directory (catches atomic renames) and the file itself (catches in-place writes).
        attach(directoryOrFile: url.deletingLastPathComponent(), mask: [.write, .rename])
        attach(directoryOrFile: url, mask: [.write, .extend, .rename, .delete, .attrib])
    }

    func watchFolder(_ rootURL: URL, onChange: @escaping @MainActor () -> Void) {
        stop()
        handler = onChange
        attachTree(rootURL)
    }

    private func attachTree(_ rootURL: URL) {
        let manager = FileManager.default
        let ignored: Set<String> = [".git", ".hg", ".svn", "__pycache__", ".venv", "venv", "node_modules", "dist", "build", ".build", ".swiftpm"]
        var dirs: [URL] = [rootURL]
        if let enumerator = manager.enumerator(
            at: rootURL,
            includingPropertiesForKeys: [.isDirectoryKey, .isSymbolicLinkKey],
            options: [.skipsHiddenFiles]
        ) {
            for case let item as URL in enumerator {
                let name = item.lastPathComponent
                if name.hasPrefix(".") || ignored.contains(name) {
                    enumerator.skipDescendants()
                    continue
                }
                guard let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .isSymbolicLinkKey]),
                      values.isSymbolicLink != true, values.isDirectory == true else { continue }
                dirs.append(item)
                if dirs.count >= 64 { break }
            }
        }
        for dir in dirs {
            attach(directoryOrFile: dir, mask: [.write, .rename, .delete])
        }
    }

    private func attach(directoryOrFile url: URL, mask: DispatchSource.FileSystemEvent) {
        let fd = open(url.path, O_EVTONLY)
        guard fd >= 0 else { return }
        let source = DispatchSource.makeFileSystemObjectSource(fileDescriptor: fd, eventMask: mask, queue: .main)
        source.setEventHandler { [weak self] in
            self?.scheduleNotify()
        }
        source.setCancelHandler {
            close(fd)
        }
        sources.append(source)
        source.resume()
    }

    private func scheduleNotify() {
        pending?.cancel()
        let work = DispatchWorkItem { [weak self] in
            MainActor.assumeIsolated { self?.handler?() }
        }
        pending = work
        DispatchQueue.main.asyncAfter(deadline: .now() + .milliseconds(180), execute: work)
    }
}
