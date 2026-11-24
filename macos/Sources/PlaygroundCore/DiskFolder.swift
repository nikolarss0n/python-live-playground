import Foundation

/// A local folder read from disk for multi-file Projects mode in the macOS app.
public struct DiskProject: Equatable, Sendable {
    public let name: String
    public let entry: String
    public let folders: [String]
    public let files: [String: String]

    public init(name: String, entry: String, folders: [String], files: [String: String]) {
        self.name = name
        self.entry = entry
        self.folders = folders
        self.files = files
    }
}

/// Safe, bounded reading and writing of a user-selected project folder on disk.
/// Mirrors `src/project/paths.ts` limits and skips dotfiles, caches, symlinks and binary files.
public enum DiskFolder {
    public static let maxFiles = 100
    public static let maxTotalChars = 1_000_000
    public static let maxFileBytes = 250_000

    private static let ignoredNames: Set<String> = [
        ".git", ".hg", ".svn", "__pycache__", ".venv", "venv", "node_modules",
        ".pytest_cache", ".mypy_cache", ".ruff_cache", ".DS_Store", "dist", "build", ".build", ".swiftpm",
    ]
    private static let blockedSegments: Set<String> = ["__proto__", "constructor", "prototype", "toString", "valueOf"]

    public enum FolderError: Error, Equatable, Sendable {
        case notAFolder
        case noPythonFiles
        case tooManyFiles
        case tooLarge
        case unsafePath
    }

    /// Relative slash-separated path matching `isProjectPath` in `src/project/paths.ts`.
    public static func isSafeRelativePath(_ path: String) -> Bool {
        guard !path.isEmpty, path.count <= 240, !path.contains("\\"), !path.contains(":") else { return false }
        let parts = path.split(separator: "/", omittingEmptySubsequences: false)
        return parts.allSatisfy { segment in
            let part = String(segment)
            guard !part.isEmpty, part.trimmingCharacters(in: .whitespacesAndNewlines) == part,
                  part != ".", part != "..", !blockedSegments.contains(part) else { return false }
            return part.unicodeScalars.allSatisfy { $0.value >= 32 && $0.value != 127 }
        }
    }

    public static func read(at rootURL: URL) throws(FolderError) -> DiskProject {
        let manager = FileManager.default
        let root = rootURL.standardizedFileURL
        var isDir: ObjCBool = false
        guard manager.fileExists(atPath: root.path, isDirectory: &isDir), isDir.boolValue else {
            throw .notAFolder
        }

        var files: [String: String] = [:]
        var folders: Set<String> = []
        var totalChars = 0

        func walk(directory: URL, prefix: String) throws(FolderError) {
            let items: [URL]
            do {
                items = try manager.contentsOfDirectory(
                    at: directory,
                    includingPropertiesForKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey],
                    options: []
                )
            } catch {
                return
            }
            for item in items.sorted(by: { $0.lastPathComponent < $1.lastPathComponent }) {
                let name = item.lastPathComponent
                // Skip dotfiles/folders (including .git, .env, .DS_Store) and common build/cache directories.
                if name.hasPrefix(".") || ignoredNames.contains(name) { continue }
                guard let values = try? item.resourceValues(forKeys: [.isDirectoryKey, .isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey]),
                      values.isSymbolicLink != true else { continue }
                let relative = prefix.isEmpty ? name : "\(prefix)/\(name)"
                guard isSafeRelativePath(relative) else { continue }

                if values.isDirectory == true {
                    folders.insert(relative)
                    try walk(directory: item, prefix: relative)
                } else if values.isRegularFile == true {
                    if let size = values.fileSize, size > maxFileBytes { continue }
                    guard let data = try? Data(contentsOf: item),
                          !data.contains(0),
                          let text = String(data: data, encoding: .utf8) else { continue }
                    guard files.count < maxFiles else { throw .tooManyFiles }
                    totalChars += text.count
                    guard totalChars <= maxTotalChars else { throw .tooLarge }
                    files[relative] = text
                }
            }
        }

        try walk(directory: root, prefix: "")

        let pythonFiles = files.keys.filter { $0.hasSuffix(".py") }.sorted { a, b in
            let aDepth = a.filter { $0 == "/" }.count
            let bDepth = b.filter { $0 == "/" }.count
            return aDepth != bDepth ? aDepth < bDepth : a < b
        }
        guard let fallbackEntry = pythonFiles.first else { throw .noPythonFiles }
        let entry = files["main.py"] != nil ? "main.py" : (files["app.py"] != nil ? "app.py" : fallbackEntry)

        let rawName = root.lastPathComponent.trimmingCharacters(in: .whitespacesAndNewlines)
        let name = rawName.isEmpty ? "project" : String(rawName.prefix(80))
        return DiskProject(name: name, entry: entry, folders: folders.sorted(), files: files)
    }

    private static func safeTarget(for relative: String, in rootURL: URL) throws(FolderError) -> URL {
        guard isSafeRelativePath(relative) else { throw .unsafePath }
        let root = rootURL.standardizedFileURL
        let rootPrefix = root.path.hasSuffix("/") ? root.path : root.path + "/"
        let target = root.appending(path: relative).standardizedFileURL
        guard target.path.hasPrefix(rootPrefix) else { throw .unsafePath }
        if let values = try? target.resourceValues(forKeys: [.isSymbolicLinkKey]), values.isSymbolicLink == true {
            throw .unsafePath
        }
        return target
    }

    /// Writes modified relative files back inside `rootURL`, refusing paths that escape the folder.
    public static func write(files: [String: String], to rootURL: URL) throws {
        let manager = FileManager.default
        for (relative, content) in files {
            let target = try safeTarget(for: relative, in: rootURL)
            let parent = target.deletingLastPathComponent()
            try manager.createDirectory(at: parent, withIntermediateDirectories: true)
            try Data(content.utf8).write(to: target, options: .atomic)
        }
    }

    /// Creates a relative folder inside `rootURL`.
    public static func createFolder(_ relative: String, in rootURL: URL) throws {
        let target = try safeTarget(for: relative, in: rootURL)
        try FileManager.default.createDirectory(at: target, withIntermediateDirectories: true)
    }

    /// Renames or moves a file or folder inside `rootURL` when the source exists on disk.
    public static func rename(from oldRelative: String, to newRelative: String, in rootURL: URL) throws {
        let source = try safeTarget(for: oldRelative, in: rootURL)
        let destination = try safeTarget(for: newRelative, in: rootURL)
        let manager = FileManager.default
        guard manager.fileExists(atPath: source.path) else { return }
        try manager.createDirectory(at: destination.deletingLastPathComponent(), withIntermediateDirectories: true)
        try manager.moveItem(at: source, to: destination)
    }

    /// Deletes a file or folder inside `rootURL` when it exists on disk.
    public static func delete(_ relative: String, in rootURL: URL) throws {
        let target = try safeTarget(for: relative, in: rootURL)
        let manager = FileManager.default
        guard manager.fileExists(atPath: target.path) else { return }
        try manager.removeItem(at: target)
    }
}
