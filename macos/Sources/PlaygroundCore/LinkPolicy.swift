import Foundation

/// Where a navigation in the app's web view may go. The page stays on `app://local`; web and mail links open in
/// the learner's default apps, and anything else is refused.
public enum LinkPolicy: Equatable, Sendable {
    case allow
    case openExternally
    case refuse

    public static func decide(_ url: URL?) -> LinkPolicy {
        guard let url, let scheme = url.scheme?.lowercased() else { return .refuse }
        switch scheme {
        case WebBundle.scheme:
            return url.host == WebBundle.host ? .allow : .refuse
        case "about", "blob", "data":
            return .allow
        case "http", "https", "mailto":
            return .openExternally
        default:
            return .refuse
        }
    }
}
