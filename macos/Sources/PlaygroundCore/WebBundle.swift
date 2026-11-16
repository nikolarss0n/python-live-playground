import Foundation

/// One response for an `app://local/...` request, built from the web files bundled inside the app.
public struct WebResponse: Sendable, Equatable {
    public let status: Int
    public let headers: [String: String]
    public let data: Data
}

/// Serves the built web app from a folder. The page gets a real origin (`app://local`), which workers, wasm and
/// module scripts need, and nothing outside the folder can be read.
public struct WebBundle: Sendable {
    public static let scheme = "app"
    public static let host = "local"
    public static let origin = URL(string: "app://local/")!

    /// Learner code can reach JavaScript through Pyodide, so the worker may load only this app's own files.
    public static let pythonWorkerCSP = [
        "default-src 'none'",
        "script-src 'self' 'wasm-unsafe-eval'",
        "connect-src 'self'",
        "worker-src 'self'",
    ].joined(separator: "; ")

    public let root: URL

    public init(root: URL) {
        self.root = root.resolvingSymlinksInPath().standardizedFileURL
    }

    /// The file a request maps to, or nil when it is not ours or would leave the bundle folder.
    public func fileURL(for url: URL) -> URL? {
        guard url.scheme == Self.scheme, url.host == Self.host else { return nil }
        let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let candidate = root.appending(path: path).resolvingSymlinksInPath().standardizedFileURL
        guard candidate.path.hasPrefix(root.path + "/") else { return nil }
        return candidate
    }

    public func response(for url: URL) -> WebResponse {
        var isDirectory: ObjCBool = false
        guard let file = fileURL(for: url),
              FileManager.default.fileExists(atPath: file.path, isDirectory: &isDirectory), !isDirectory.boolValue,
              let data = try? Data(contentsOf: file, options: .mappedIfSafe)
        else {
            return WebResponse(status: 404, headers: ["Content-Type": "text/plain; charset=utf-8"], data: Data("Not found".utf8))
        }
        var headers = [
            "Content-Type": Self.mimeType(forExtension: file.pathExtension),
            "Content-Length": String(data.count),
            "Cache-Control": "no-cache",
        ]
        if Self.isPythonWorker(file.lastPathComponent) {
            headers["Content-Security-Policy"] = Self.pythonWorkerCSP
        }
        return WebResponse(status: 200, headers: headers, data: data)
    }

    /// A production build names the worker `python.worker-<hash>.js`.
    public static func isPythonWorker(_ name: String) -> Bool {
        name.hasPrefix("python.worker-") && name.hasSuffix(".js")
    }

    public static func mimeType(forExtension ext: String) -> String {
        switch ext.lowercased() {
        case "html": "text/html; charset=utf-8"
        case "js", "mjs": "text/javascript; charset=utf-8"
        case "css": "text/css; charset=utf-8"
        case "json", "map": "application/json; charset=utf-8"
        case "wasm": "application/wasm"
        case "svg": "image/svg+xml"
        case "png": "image/png"
        case "woff2": "font/woff2"
        case "txt", "py": "text/plain; charset=utf-8"
        default: "application/octet-stream"
        }
    }
}
