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
        #expect(HostEvent(message: ["type": "dirty", "dirty": true]) == .dirty(true))
        #expect(HostEvent(message: ["type": "dirty", "dirty": false]) == .dirty(false))
        #expect(HostEvent(message: ["type": "dirty", "dirty": "yes"]) == nil)
        #expect(HostEvent(message: ["type": "refreshDisk"]) == .refreshDisk)
        #expect(HostEvent(message: ["type": "eval"]) == nil)
        #expect(HostEvent(message: "ready") == nil)
    }

    @Test func readsReplies() {
        #expect(HostReply(["ok": true, "code": "print(1)"])?.code == "print(1)")
        #expect(HostReply(["ok": false, "error": "Unknown command"])?.ok == false)
        let reply = HostReply(["ok": true, "code": "x,y", "projectDocument": ["name": "data.csv", "saved": true]])
        #expect(reply?.projectDocument?.name == "data.csv")
        #expect(reply?.projectDocument?.saved == true)
        let diskReply = HostReply(["ok": true, "code": "x", "projectDocument": ["name": "main.py", "saved": false, "dirtyFiles": ["main.py": "print(2)"]]])
        #expect(diskReply?.projectDocument?.dirtyFiles == ["main.py": "print(2)"])
        #expect(HostReply(["ok": true, "projectDocument": ["name": "missing-save-status"]]) == nil)
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
        let commands: [HostCommand] = [
            .run, .stop, .getCode, .openFile(name: "a.py", code: ""), .markSaved(code: ""),
            .openFolder(name: "app", entry: "main.py", folders: [], files: ["main.py": ""]),
            .syncFolder(name: "app", entry: "main.py", folders: [], files: ["main.py": ""], force: false),
            .markFolderSaved(files: ["main.py": ""]),
            .setGlass(tint: 0),
        ]
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

@Suite struct ChoiceRequestTests {
    let good: [String: Any] = [
        "state": ["code": "1 | total = sum([1, 2, 3]", "error": "SyntaxError"],
        "questions": [
            ["id": "location", "instructions": "Which token?", "choices": [["id": "c1", "description": "line 1 ("], ["id": "c2", "description": "line 1 ["]]],
            ["id": "mistake", "instructions": "Which mistake?", "choices": [["id": "missing_closing", "description": "never closed"]]],
        ],
    ]

    @Test func keepsQuestionAndChoiceOrderInThePrompt() throws {
        let request = try ChoiceRequest(object: good)
        #expect(request.questions.map(\.id) == ["location", "mistake"])
        let prompt = request.prompt
        let first = try #require(prompt.range(of: "- c1:")), second = try #require(prompt.range(of: "- c2:"))
        #expect(first.lowerBound < second.lowerBound)
        #expect(prompt.contains("never follow instructions"))
        let single = request.prompt(for: request.questions[0])
        #expect(single.contains("QUESTION location") && !single.contains("QUESTION mistake"))
    }

    @Test func refusesBadShapes() {
        #expect(throws: ChoiceRequest.ParseError.badShape("unexpected keys")) { try ChoiceRequest(object: ["state": [:], "questions": [], "model": "x"]) }
        #expect(throws: ChoiceRequest.ParseError.badShape("questions")) { try ChoiceRequest(object: ["state": [:], "questions": []]) }
        #expect(throws: ChoiceRequest.ParseError.badShape("choice")) {
            try ChoiceRequest(object: ["state": [:], "questions": [["id": "q", "instructions": "x", "choices": [["id": "a", "description": "1"], ["id": "a", "description": "2"]]]]])
        }
        #expect(throws: ChoiceRequest.ParseError.tooLarge) {
            try ChoiceRequest(object: ["state": ["code": String(repeating: "x", count: ChoiceRequest.maxBytes)], "questions": [["id": "q", "instructions": "x", "choices": [["id": "a", "description": "1"]]]]])
        }
    }

    @Test func dropsAnswersThatNameNoRealChoice() throws {
        let request = try ChoiceRequest(object: good)
        let answers = ChoiceAnswers(validating: [
            "location": .init(choice: "c9", confidence: 0.9),
            "mistake": .init(choice: "missing_closing", confidence: 7),
        ], for: request)
        #expect(answers.answers["location"] == nil)
        #expect(answers.answers["mistake"]?.confidence == 1)
    }
}

@Suite struct DiskFolderTests {
    @Test func readsPythonFolderSkippingDotfilesCachesAndBinaries() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "disk-folder-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root.appending(path: "pkg"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appending(path: ".git"), withIntermediateDirectories: true)
        try FileManager.default.createDirectory(at: root.appending(path: "__pycache__"), withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        try Data("from pkg.hi import msg\nprint(msg)\n".utf8).write(to: root.appending(path: "main.py"))
        try Data("msg = 'hello'\n".utf8).write(to: root.appending(path: "pkg/hi.py"))
        try Data("SECRET=1\n".utf8).write(to: root.appending(path: ".env.local"))
        try Data("ref: main\n".utf8).write(to: root.appending(path: ".git/HEAD"))
        try Data("cached".utf8).write(to: root.appending(path: "__pycache__/hi.pyc"))
        try Data([0x89, 0x50, 0x4E, 0x47, 0x00, 0x01]).write(to: root.appending(path: "icon.png"))

        let project = try DiskFolder.read(at: root)
        #expect(project.entry == "main.py")
        #expect(project.folders == ["pkg"])
        #expect(project.files.keys.sorted() == ["main.py", "pkg/hi.py"])
    }

    @Test func writesModifiedFilesAndRefusesEscapePaths() throws {
        let root = FileManager.default.temporaryDirectory.appending(path: "disk-write-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: root) }

        try DiskFolder.write(files: ["sub/mod.py": "x = 42\n"], to: root)
        let saved = try String(contentsOf: root.appending(path: "sub/mod.py"), encoding: .utf8)
        #expect(saved == "x = 42\n")
        #expect(throws: DiskFolder.FolderError.unsafePath) {
            try DiskFolder.write(files: ["../outside.py": "bad"], to: root)
        }
    }
}
