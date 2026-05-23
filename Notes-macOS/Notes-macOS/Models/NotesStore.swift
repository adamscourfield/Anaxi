import Foundation
import Combine

enum SidebarFilter: Hashable {
    case all, favorites, uncategorized
    case folder(id: String)

    var defaultTitle: String {
        switch self {
        case .all:           return "All Notes"
        case .favorites:     return "Favorites"
        case .uncategorized: return "Uncategorized"
        case .folder:        return "Notes"
        }
    }
}

enum NoteSort: String, CaseIterable, Identifiable {
    case updated      = "Recent"
    case created      = "Created"
    case alphabetical = "A–Z"
    var id: String { rawValue }
}

final class NotesStore: ObservableObject {
    @Published var folders: [Folder] = []
    @Published var notes: [Note] = []
    @Published var selectedFilter: SidebarFilter = .all
    @Published var selectedNoteId: String? = nil
    @Published var isDistractionFree = false

    private var saveTask: DispatchWorkItem?

    private struct StoredData: Codable {
        var folders: [Folder]
        var notes: [Note]
    }

    private var dataURL: URL {
        let support = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        let dir = support.appendingPathComponent("Notes", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir.appendingPathComponent("data.json")
    }

    init() {
        loadData()
        if folders.isEmpty && notes.isEmpty { seedDefaults() }
        selectFirstVisibleNote()
    }

    // MARK: – Queries

    func filteredNotes(search: String = "", sortBy: NoteSort = .updated) -> [Note] {
        var result: [Note]
        if !search.trimmingCharacters(in: .whitespaces).isEmpty {
            let q = search.lowercased()
            result = notes.filter {
                $0.title.lowercased().contains(q) || $0.content.lowercased().contains(q)
            }
        } else {
            result = notes.filter { matches(note: $0, filter: selectedFilter) }
        }
        switch sortBy {
        case .updated:      result.sort { $0.updatedAt > $1.updatedAt }
        case .created:      result.sort { $0.createdAt > $1.createdAt }
        case .alphabetical: result.sort { $0.title.localizedCompare($1.title) == .orderedAscending }
        }
        return result
    }

    func noteCount(for filter: SidebarFilter) -> Int {
        notes.filter { matches(note: $0, filter: filter) }.count
    }

    func folder(for id: String) -> Folder? {
        folders.first { $0.id == id }
    }

    func selectFirstVisibleNote() {
        selectedNoteId = filteredNotes().first?.id
    }

    // MARK: – Note Actions

    func createNote() {
        var folderId: String? = nil
        if case .folder(let id) = selectedFilter { folderId = id }
        let note = Note(title: "Untitled Note", folderId: folderId)
        notes.insert(note, at: 0)
        selectedNoteId = note.id
        scheduleSave()
    }

    func updateNote(id: String, title: String? = nil, content: String? = nil, attributedContent: Data? = nil) {
        guard let idx = notes.firstIndex(where: { $0.id == id }) else { return }
        if let v = title            { notes[idx].title = v }
        if let v = content          { notes[idx].content = v }
        if let v = attributedContent { notes[idx].attributedContent = v }
        notes[idx].updatedAt = Date()
        scheduleSave()
    }

    func deleteNote(id: String) {
        notes.removeAll { $0.id == id }
        if selectedNoteId == id { selectFirstVisibleNote() }
        scheduleSave()
    }

    func toggleFavorite(id: String) {
        guard let idx = notes.firstIndex(where: { $0.id == id }) else { return }
        notes[idx].isFavorite.toggle()
        notes[idx].updatedAt = Date()
        scheduleSave()
    }

    func moveNote(id: String, toFolder folderId: String?) {
        guard let idx = notes.firstIndex(where: { $0.id == id }) else { return }
        notes[idx].folderId = folderId
        notes[idx].updatedAt = Date()
        scheduleSave()
    }

    // MARK: – Folder Actions

    func createFolder(name: String) {
        let folder = Folder(name: name)
        folders.append(folder)
        selectedFilter = .folder(id: folder.id)
        selectFirstVisibleNote()
        scheduleSave()
    }

    func renameFolder(id: String, name: String) {
        guard let idx = folders.firstIndex(where: { $0.id == id }) else { return }
        folders[idx].name = name
        scheduleSave()
    }

    func deleteFolder(id: String) {
        folders.removeAll { $0.id == id }
        for idx in notes.indices where notes[idx].folderId == id {
            notes[idx].folderId = nil
            notes[idx].updatedAt = Date()
        }
        if case .folder(let fid) = selectedFilter, fid == id {
            selectedFilter = .all
            selectFirstVisibleNote()
        }
        scheduleSave()
    }

    // MARK: – Persistence

    private func scheduleSave() {
        saveTask?.cancel()
        let task = DispatchWorkItem { [weak self] in self?.saveData() }
        saveTask = task
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.4, execute: task)
    }

    private func saveData() {
        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        guard let data = try? encoder.encode(StoredData(folders: folders, notes: notes)) else { return }
        try? data.write(to: dataURL, options: .atomic)
    }

    private func loadData() {
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let raw = try? Data(contentsOf: dataURL),
              let stored = try? decoder.decode(StoredData.self, from: raw) else { return }
        folders = stored.folders
        notes   = stored.notes
    }

    private func seedDefaults() {
        folders = [
            Folder(id: "folder-1", name: "Creative Drafts"),
            Folder(id: "folder-2", name: "Notes & Guides")
        ]
        var n1 = Note(id: "note-1", title: "Distraction-Free Design", folderId: "folder-1")
        n1.content = "Welcome to your minimalist writing environment.\n\nThis workspace is designed for notes purists who love clean layouts, quick workflow, and beautiful typography.\n\nPhilosophy:\n• Pure white background preserves visual serenity.\n• Native macOS typography for comfortable reading.\n• System fonts maximise legibility.\n\nTry dragging a note from the middle column onto a folder in the sidebar to organise it."
        n1.isFavorite = true

        var n2 = Note(id: "note-2", title: "Organise & Drag-Drop Guide", folderId: "folder-2")
        n2.content = "Efficient note-taking is built on robust mechanics:\n\n1. Folders: Click the '+' icon next to 'Folders' in the sidebar to create custom folders.\n2. Drag & Drop: Drag any note from the middle column directly onto a folder in the sidebar.\n3. Favorites: Click the star icon on any note to pin it to the Favorites list.\n4. Context Menus: Right-click any note or folder for quick actions.\n5. Keyboard Shortcuts: ⌘N new note, ⌘B bold, ⌘I italic, ⌘U underline."

        var n3 = Note(id: "note-3", title: "A Spark of Insight", folderId: nil)
        n3.content = "Complexity is a failure of restraint. Beautiful design is always simple and completely honest."

        notes = [n1, n2, n3]
        saveData()
    }

    // MARK: – Helpers

    private func matches(note: Note, filter: SidebarFilter) -> Bool {
        switch filter {
        case .all:           return true
        case .favorites:     return note.isFavorite
        case .uncategorized: return note.folderId == nil
        case .folder(let id): return note.folderId == id
        }
    }
}
