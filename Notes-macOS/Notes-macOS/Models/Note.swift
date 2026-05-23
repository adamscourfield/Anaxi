import Foundation

struct Note: Identifiable, Codable, Equatable {
    var id: String
    var title: String
    var content: String         // plain text for search/preview
    var attributedContent: Data? // RTF data for rich text
    var folderId: String?
    var createdAt: Date
    var updatedAt: Date
    var isFavorite: Bool

    init(
        id: String = UUID().uuidString,
        title: String = "Untitled Note",
        content: String = "",
        folderId: String? = nil
    ) {
        self.id = id
        self.title = title
        self.content = content
        self.attributedContent = nil
        self.folderId = folderId
        self.createdAt = Date()
        self.updatedAt = Date()
        self.isFavorite = false
    }

    var previewText: String {
        content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "No additional text"
            : content
    }

    var wordCount: Int {
        content.split(whereSeparator: { $0.isWhitespace || $0.isNewline })
               .filter { !$0.isEmpty }.count
    }

    var charCount: Int { content.count }

    var readingTimeMinutes: Int { max(1, wordCount / 200) }
}
