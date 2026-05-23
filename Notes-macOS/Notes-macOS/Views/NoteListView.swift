import SwiftUI

struct NoteListView: View {
    @EnvironmentObject var store: NotesStore
    @State private var searchText = ""
    @State private var sortBy: NoteSort = .updated

    private var displayNotes: [Note] {
        store.filteredNotes(search: searchText, sortBy: sortBy)
    }

    private var listTitle: String {
        switch store.selectedFilter {
        case .all:              return "All Notes"
        case .favorites:        return "Favorites"
        case .uncategorized:    return "Uncategorized"
        case .folder(let id):   return store.folder(for: id)?.name ?? "Notes"
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            // Header
            VStack(alignment: .leading, spacing: 4) {
                Text(listTitle)
                    .font(.title2.bold())
                HStack {
                    Text("\(displayNotes.count) \(displayNotes.count == 1 ? "note" : "notes")")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Picker("Sort", selection: $sortBy) {
                        ForEach(NoteSort.allCases) { sort in
                            Text(sort.rawValue).tag(sort)
                        }
                    }
                    .pickerStyle(.menu)
                    .labelsHidden()
                    .controlSize(.small)
                }
            }
            .padding(.horizontal, 14)
            .padding(.top, 14)
            .padding(.bottom, 10)

            Divider()

            if displayNotes.isEmpty {
                VStack {
                    Spacer()
                    Text(searchText.isEmpty ? "No notes here" : "No results for "\(searchText)"")
                        .font(.system(size: 12, design: .monospaced))
                        .foregroundStyle(.tertiary)
                        .italic()
                        .multilineTextAlignment(.center)
                    Spacer()
                }
            } else {
                List(displayNotes, id: \.id, selection: Binding(
                    get: { store.selectedNoteId },
                    set: { store.selectedNoteId = $0 }
                )) { note in
                    NoteRowView(note: note)
                        .tag(note.id)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                }
                .listStyle(.plain)
            }
        }
        .searchable(text: $searchText, placement: .toolbar, prompt: "Search notes…")
        .onChange(of: store.selectedFilter) { _ in
            let visible = store.filteredNotes(search: searchText, sortBy: sortBy)
            if !visible.contains(where: { $0.id == store.selectedNoteId }) {
                store.selectedNoteId = visible.first?.id
            }
        }
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button(action: store.createNote) {
                    Label("New Note", systemImage: "square.and.pencil")
                }
                .help("New Note (⌘N)")
            }
        }
    }
}
