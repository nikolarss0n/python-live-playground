// Answers one ChoiceRequest (JSON on stdin) with Apple's on-device model and prints `{ answers }` as JSON.
// Used by `npm run verify:jev -- --backend apple` to score the model on the same cases as TypeSafe.
import Foundation
import PlaygroundAI
import PlaygroundCore

let backend: AppleChoiceModel.Backend = CommandLine.arguments.contains("--cloud") ? .privateCloud : .onDevice
let input = FileHandle.standardInput.readDataToEndOfFile()
do {
    let request = try ChoiceRequest(json: input)
    let answers = try await AppleChoiceModel.answer(request, backend: backend)
    let data = try JSONSerialization.data(withJSONObject: answers.payload, options: [.sortedKeys])
    FileHandle.standardOutput.write(data)
} catch {
    FileHandle.standardError.write(Data("playground-ai: \(error)\n".utf8))
    let data = (try? JSONSerialization.data(withJSONObject: ["error": "\(error)"])) ?? Data()
    FileHandle.standardOutput.write(data)
    exit(1)
}
