// swift-tools-version: 6.2
import PackageDescription

let package = Package(
    name: "PythonPlayground",
    platforms: [.macOS("27.0")],
    products: [
        .executable(name: "PythonPlayground", targets: ["PythonPlayground"]),
        .executable(name: "playground-ai", targets: ["playground-ai"]),
    ],
    targets: [
        .target(name: "PlaygroundCore"),
        .target(name: "PlaygroundAI", dependencies: ["PlaygroundCore"]),
        .executableTarget(name: "PythonPlayground", dependencies: ["PlaygroundCore", "PlaygroundAI"]),
        .executableTarget(name: "playground-ai", dependencies: ["PlaygroundCore", "PlaygroundAI"]),
        .testTarget(name: "PlaygroundCoreTests", dependencies: ["PlaygroundCore"]),
    ]
)
