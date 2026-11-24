import Foundation

/// The Swift half of the protocol in `src/host/macHost.ts`. Keep the two in step; `HostProtocolTests` checks the
/// command names against the TypeScript file.
public enum HostProtocol {
    public static let version = 1
    public static let messageHandlerName = "playgroundHost"
    /// The largest file the app opens, matching `MAX_OPEN_FILE_CHARS` and the share-link guard.
    public static let maxOpenFileCharacters = 80_000
}

public enum HostCommand: Equatable, Sendable {
    case run
    case stop
    case getCode
    case openFile(name: String, code: String)
    case markSaved(code: String)
    case openFolder(name: String, entry: String, folders: [String], files: [String: String])
    case syncFolder(name: String, entry: String, folders: [String], files: [String: String], force: Bool)
    case markFolderSaved(files: [String: String])
    case setGlass(tint: Double)

    /// The value passed to `window.playgroundHost.handle(command)`.
    public var payload: [String: any Sendable] {
        switch self {
        case .run: ["type": "run"]
        case .stop: ["type": "stop"]
        case .getCode: ["type": "getCode"]
        case let .openFile(name, code): ["type": "openFile", "name": name, "code": code]
        case let .markSaved(code): ["type": "markSaved", "code": code]
        case let .openFolder(name, entry, folders, files):
            ["type": "openFolder", "name": name, "entry": entry, "folders": folders, "files": files]
        case let .syncFolder(name, entry, folders, files, force):
            ["type": "syncFolder", "name": name, "entry": entry, "folders": folders, "files": files, "force": force]
        case let .markFolderSaved(files): ["type": "markFolderSaved", "files": files]
        case let .setGlass(tint): ["type": "setGlass", "tint": tint]
        }
    }
}

public enum HostEvent: Equatable, Sendable {
    case ready(version: Int)
    case theme(dark: Bool)
    case dirty(Bool)
    case refreshDisk
    case diskMutation(op: String, path: String, newPath: String?)

    /// Reads a message the page posted; anything unexpected is ignored.
    public init?(message body: Any) {
        guard let body = body as? [String: Any], let type = body["type"] as? String else { return nil }
        switch type {
        case "ready":
            guard let version = body["version"] as? Int else { return nil }
            self = .ready(version: version)
        case "theme":
            guard let theme = body["theme"] as? String, theme == "dark" || theme == "light" else { return nil }
            self = .theme(dark: theme == "dark")
        case "dirty":
            guard let dirty = body["dirty"] as? Bool else { return nil }
            self = .dirty(dirty)
        case "refreshDisk":
            self = .refreshDisk
        case "diskMutation":
            guard let op = body["op"] as? String, let path = body["path"] as? String,
                  DiskFolder.isSafeRelativePath(path) else { return nil }
            switch op {
            case "createFolder", "delete":
                self = .diskMutation(op: op, path: path, newPath: nil)
            case "rename":
                guard let newPath = body["newPath"] as? String, DiskFolder.isSafeRelativePath(newPath) else { return nil }
                self = .diskMutation(op: op, path: path, newPath: newPath)
            default:
                return nil
            }
        default:
            return nil
        }
    }
}

/// What `handle` returned: `{ ok: true, code? }` or `{ ok: false, error }`.
public struct HostReply: Equatable, Sendable {
    public let ok: Bool
    public let code: String?
    public struct ProjectDocument: Equatable, Sendable {
        public let name: String
        public let saved: Bool
        public let dirtyFiles: [String: String]?
    }
    public let projectDocument: ProjectDocument?

    public init?(_ value: Any?) {
        guard let value = value as? [String: Any], let ok = value["ok"] as? Bool else { return nil }
        self.ok = ok
        code = value["code"] as? String
        if let metadata = value["projectDocument"] {
            guard let project = metadata as? [String: Any], let name = project["name"] as? String,
                  let saved = project["saved"] as? Bool else { return nil }
            let dirtyFiles: [String: String]?
            if let raw = project["dirtyFiles"] {
                guard let map = raw as? [String: String] else { return nil }
                dirtyFiles = map
            } else {
                dirtyFiles = nil
            }
            projectDocument = ProjectDocument(name: name, saved: saved, dirtyFiles: dirtyFiles)
        } else {
            projectDocument = nil
        }
    }
}

public enum PythonFile {
    public enum ReadError: Error, Equatable {
        case notText
        case tooLarge
    }

    /// The text of a file the learner opened, refusing what the page would refuse.
    public static func text(from data: Data) throws(ReadError) -> String {
        guard let text = String(data: data, encoding: .utf8) else { throw .notText }
        guard text.count <= HostProtocol.maxOpenFileCharacters else { throw .tooLarge }
        return text
    }

    /// The name offered by Save As when the code has never been saved.
    public static let untitledName = "untitled.py"
}
