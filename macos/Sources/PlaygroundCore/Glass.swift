import Foundation

/// The frosted window, after int-ai-m: one Background Transparency setting from 0 (a solid page) to 1 (the desktop
/// shows through clear). The first 70% thins the page colour over the blur; the last 30% fades the blur itself.
/// Text, code and controls are drawn above both and never fade.
public enum Glass {
    public static let defaultTransparency = 0.2
    /// The share of the slider, at its clear end, that fades the blur.
    static let blurShare = 0.3

    /// How strong the blur of the desktop is.
    public static func blurAlpha(transparency: Double) -> Double {
        min(1, max(0, (1 - clamp(transparency)) / blurShare))
    }

    /// How much of the page colour covers the blur: 1 is solid, 0 leaves only the blur.
    public static func tint(transparency: Double) -> Double {
        max(0, (1 - clamp(transparency) - blurShare) / (1 - blurShare))
    }

    /// The system's Reduce Transparency setting wins over the slider: no blur, solid page.
    public static func appearance(transparency: Double, reduceTransparency: Bool) -> (blur: Double, tint: Double) {
        reduceTransparency ? (0, 1) : (blurAlpha(transparency: transparency), tint(transparency: transparency))
    }

    public static func percent(_ transparency: Double) -> String {
        "\(Int((clamp(transparency) * 100).rounded()))%"
    }

    static func clamp(_ value: Double) -> Double {
        value.isFinite ? min(1, max(0, value)) : defaultTransparency
    }
}
