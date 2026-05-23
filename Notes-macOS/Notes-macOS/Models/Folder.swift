import Foundation

struct Folder: Identifiable, Codable, Equatable {
    var id: String
    var name: String
    var createdAt: Date

    init(id: String = UUID().uuidString, name: String) {
        self.id = id
        self.name = name
        self.createdAt = Date()
    }
}
