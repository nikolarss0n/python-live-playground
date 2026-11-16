import Foundation
import Testing
@testable import PlaygroundCore

@Suite struct GlassTests {
    @Test func zeroIsASolidPageAndOneIsClear() {
        #expect(Glass.appearance(transparency: 0, reduceTransparency: false) == (1, 1))
        #expect(Glass.appearance(transparency: 1, reduceTransparency: false) == (0, 0))
    }

    @Test func thePageThinsFirstThenTheBlurFades() {
        #expect(Glass.blurAlpha(transparency: 0.7) == 1)
        #expect(abs(Glass.tint(transparency: 0.35) - 0.5) < 1e-9)
        #expect(Glass.tint(transparency: 0.7) < 1e-9)
        #expect(abs(Glass.blurAlpha(transparency: 0.85) - 0.5) < 1e-9)
    }

    @Test func reduceTransparencyWins() {
        #expect(Glass.appearance(transparency: 0.9, reduceTransparency: true) == (0, 1))
    }

    @Test func badValuesFallBackAndPercentRounds() {
        #expect(Glass.tint(transparency: .nan) == Glass.tint(transparency: Glass.defaultTransparency))
        #expect(Glass.blurAlpha(transparency: -3) == 1)
        #expect(Glass.percent(0.204) == "20%")
    }
}

@Suite struct RecentFilesTests {
    let defaults: UserDefaults
    let recent: RecentFiles

    init() {
        let suite = "recent-files-\(UUID().uuidString)"
        defaults = UserDefaults(suiteName: suite)!
        defaults.removePersistentDomain(forName: suite)
        recent = RecentFiles(
            defaults: defaults,
            makeBookmark: { Data($0.path.utf8) },
            resolveBookmark: { data in
                let path = String(decoding: data, as: UTF8.self)
                guard !path.contains("gone") else { throw CocoaError(.fileNoSuchFile) }
                return URL(filePath: path)
            }
        )
    }

    @Test func newestFirstWithoutDuplicates() {
        recent.add(URL(filePath: "/a.py"))
        recent.add(URL(filePath: "/b.py"))
        recent.add(URL(filePath: "/a.py"))
        #expect(recent.urls().map(\.path) == ["/a.py", "/b.py"])
    }

    @Test func keepsTheLimitAndDropsMissingFiles() {
        recent.add(URL(filePath: "/gone.py"))
        for index in 0..<12 { recent.add(URL(filePath: "/\(index).py")) }
        #expect(recent.urls().count == RecentFiles.limit)
        #expect(recent.urls().first?.path == "/11.py")
        #expect(!recent.urls().contains { $0.path == "/gone.py" })
        recent.clear()
        #expect(recent.urls().isEmpty)
    }
}

@Suite struct HostProtocolTests {
    @Test func readsOnlyKnownEvents() {
        #expect(HostEvent(message: ["type": "ready", "version": 1]) == .ready(version: 1))
        #expect(HostEvent(message: ["type": "theme", "theme": "dark"]) == .theme(dark: true))
        #expect(HostEvent(message: ["type": "theme", "theme": "purple"]) == nil)
        #expect(HostEvent(message: ["type": "eval"]) == nil)
        #expect(HostEvent(message: "ready") == nil)
    }

    @Test func readsReplies() {
        #expect(HostReply(["ok": true, "code": "print(1)"])?.code == "print(1)")
        #expect(HostReply(["ok": false, "error": "Unknown command"])?.ok == false)
        #expect(HostReply(nil) == nil)
    }

    @Test func opensOnlyUTF8TextWithinTheLimit() throws {
        #expect(try PythonFile.text(from: Data("print('hi')\n".utf8)) == "print('hi')\n")
        #expect(throws: PythonFile.ReadError.notText) { try PythonFile.text(from: Data([0xFF, 0xFE, 0x00])) }
        #expect(throws: PythonFile.ReadError.tooLarge) {
            try PythonFile.text(from: Data(String(repeating: "x", count: HostProtocol.maxOpenFileCharacters + 1).utf8))
        }
    }

    /// Both halves of the bridge must agree on the command names, the version and the file limit.
    @Test func matchesTheTypeScriptProtocol() throws {
        let source = URL(filePath: #filePath).deletingLastPathComponent()
            .appending(path: "../../../src/host/macHost.ts").standardizedFileURL
        let typescript = try String(contentsOf: source, encoding: .utf8)
        let commands: [HostCommand] = [.run, .stop, .getCode, .openFile(name: "a.py", code: ""), .setGlass(tint: 0)]
        for command in commands {
            let name = try #require(command.payload["type"] as? String)
            #expect(typescript.contains("type: '\(name)'"), "macHost.ts has no '\(name)' command")
        }
        #expect(typescript.contains("HOST_PROTOCOL_VERSION = \(HostProtocol.version)"))
        #expect(typescript.contains("MAX_OPEN_FILE_CHARS = 80_000") && HostProtocol.maxOpenFileCharacters == 80_000)
    }
}

@Suite struct LinkPolicyTests {
    @Test func keepsThePageAtHomeAndSendsTheWebOut() {
        #expect(LinkPolicy.decide(URL(string: "app://local/?lesson=playground")) == .allow)
        #expect(LinkPolicy.decide(URL(string: "about:srcdoc")) == .allow)
        #expect(LinkPolicy.decide(URL(string: "https://docs.python.org/3/")) == .openExternally)
        #expect(LinkPolicy.decide(URL(string: "http://127.0.0.1:8765/index.html")) == .openExternally)
        #expect(LinkPolicy.decide(URL(string: "mailto:help@example.com")) == .openExternally)
    }

    @Test func refusesEverythingElse() {
        #expect(LinkPolicy.decide(URL(string: "app://elsewhere/")) == .refuse)
        #expect(LinkPolicy.decide(URL(string: "file:///etc/passwd")) == .refuse)
        #expect(LinkPolicy.decide(URL(string: "javascript:alert(1)")) == .refuse)
        #expect(LinkPolicy.decide(nil) == .refuse)
    }
}
