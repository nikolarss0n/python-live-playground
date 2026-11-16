// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PythonPlayground",
    platforms: [.macOS("27.0")],
    targets: [
        .target(name: "PlaygroundCore"),
        .executableTarget(name: "PythonPlayground", dependencies: ["PlaygroundCore"]),
        .testTarget(name: "PlaygroundCoreTests", dependencies: ["PlaygroundCore"]),
    ]
)
