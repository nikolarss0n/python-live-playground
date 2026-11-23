import Foundation
import FoundationModels
import PlaygroundCore

/// Answers a `ChoiceRequest` with Apple's on-device model. Guided generation constrains every answer to the
/// question's own choice ids, so the model cannot return a line or verdict the page does not know.
public enum AppleChoiceModel {
    /// The small model on the Mac, or Apple's larger model on Private Cloud Compute (free for small developers).
    public enum Backend: String, Sendable {
        case onDevice = "on-device"
        case privateCloud = "cloud"
    }

    public enum Failure: Error, CustomStringConvertible {
        case unavailable(String)
        case unreadable(String)

        public var description: String {
            switch self {
            case let .unavailable(reason): "Apple's on-device model is not available: \(reason)"
            case let .unreadable(detail): "The model's answer could not be read: \(detail)"
            }
        }
    }

    /// Nil when the model can answer; otherwise why not (Apple Intelligence off, still downloading, ...).
    public static func unavailableReason(_ backend: Backend = .onDevice) -> String? {
        switch backend {
        case .onDevice:
            switch SystemLanguageModel.default.availability {
            case .available: return nil
            case let .unavailable(reason): return "\(reason)"
            }
        case .privateCloud:
            switch PrivateCloudComputeLanguageModel().availability {
            case .available: return nil
            case let .unavailable(reason): return "\(reason)"
            }
        }
    }

    public static func answer(_ request: ChoiceRequest, backend: Backend = .onDevice) async throws -> ChoiceAnswers {
        if let reason = unavailableReason(backend) { throw Failure.unavailable(reason) }
        var answers: [String: ChoiceAnswers.Answer] = [:]
        for question in request.questions {
            let schema = try GenerationSchema(root: schema(for: question), dependencies: [])
            let session = switch backend {
            case .onDevice: LanguageModelSession(model: SystemLanguageModel.default, instructions: ChoiceRequest.instructions)
            case .privateCloud: LanguageModelSession(model: PrivateCloudComputeLanguageModel(), instructions: ChoiceRequest.instructions)
            }
            let response = try await session.respond(
                to: request.prompt(for: question),
                schema: schema,
                options: GenerationOptions(samplingMode: .greedy, maximumResponseTokens: 220)
            )
            do {
                answers[question.id] = ChoiceAnswers.Answer(
                    choice: try response.content.value(String.self, forProperty: "choice"),
                    confidence: try response.content.value(Double.self, forProperty: "confidence")
                )
            } catch {
                throw Failure.unreadable("\(question.id): \(error)")
            }
        }
        return ChoiceAnswers(validating: answers, for: request)
    }

    /// `{ reason, choice: one of the question's ids, confidence: 0…1 }`. Reasoning precedes choice so small models
    /// check the code and output before committing to an id.
    static func schema(for question: ChoiceRequest.Question) -> DynamicGenerationSchema {
        DynamicGenerationSchema(name: "Answer_\(question.id)", properties: [
            .init(name: "reason", description: "One brief reason (under 20 words) checking the exact code and output", schema: DynamicGenerationSchema(type: String.self)),
            .init(name: "choice", description: "The id of the chosen choice", schema: DynamicGenerationSchema(
                name: "Choice_\(question.id)", anyOf: question.choices.map(\.id)
            )),
            .init(name: "confidence", description: "How sure, from 0 to 1", schema: DynamicGenerationSchema(
                type: Double.self, guides: [.range(0...1)]
            )),
        ])
    }
}
