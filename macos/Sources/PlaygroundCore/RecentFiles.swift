import Foundation

/// Files the learner opened or saved, newest first, kept as security-scoped bookmarks so the sandboxed app can
/// open them again after a relaunch.
public struct RecentFiles {
    public static let limit = 10
    static let key = "recentFileBookmarks"

    private let defaults: UserDefaults
    private let makeBookmark: (URL) throws -> Data
    private let resolveBookmark: (Data) throws -> URL

    public init(
        defaults: UserDefaults = .standard,
        makeBookmark: @escaping (URL) throws -> Data = { try $0.bookmarkData(options: .withSecurityScope) },
        resolveBookmark: @escaping (Data) throws -> URL = { data in
            var stale = false
            return try URL(resolvingBookmarkData: data, options: .withSecurityScope, bookmarkDataIsStale: &stale)
        }
    ) {
        self.defaults = defaults
        self.makeBookmark = makeBookmark
        self.resolveBookmark = resolveBookmark
    }

    /// The files that can still be found, newest first. Bookmarks that no longer resolve are dropped.
    public func urls() -> [URL] {
        entries().compactMap { try? resolveBookmark($0) }
    }

    public func add(_ url: URL) {
        guard let bookmark = try? makeBookmark(url) else { return }
        let others = entries().filter { (try? resolveBookmark($0))?.standardizedFileURL != url.standardizedFileURL }
        defaults.set(Array(([bookmark] + others).prefix(Self.limit)), forKey: Self.key)
    }

    public func clear() {
        defaults.removeObject(forKey: Self.key)
    }

    private func entries() -> [Data] {
        defaults.array(forKey: Self.key) as? [Data] ?? []
    }
}
