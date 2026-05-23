import SwiftUI

struct NoteRowView: View {
    @EnvironmentObject var store: NotesStore
    let note: Note

    @State private var isHovered = false
    @State private var showDeleteAlert = false

    private var folderName: String? {
        note.folderId.flatMap { store.folder(for: $0)?.name }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            HStack(alignment: .top, spacing: 6) {
                Text(note.title.isEmpty ? "Untitled Note" : note.title)
                    .font(.system(size: 13.5, weight: .semibold))
                    .lineLimit(1)
                Spacer(minLength: 4)
                if note.isFavorite {
                    Image(systemName: "star.fill")
                        .font(.system(size: 10))
                        .foregroundStyle(.yellow)
                }
            }

            Text(note.previewText)
                .font(.system(size: 12.5))
                .foregroundStyle(.secondary)
                .lineLimit(1)

            HStack(spacing: 6) {
                Text(formattedDate(note.updatedAt))
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.tertiary)

                if let name = folderName {
                    Text(name)
                        .font(.system(size: 10))
                        .padding(.horizontal, 5)
                        .padding(.vertical, 1.5)
                        .background(Color.secondary.opacity(0.12))
                        .cornerRadius(3)
                        .lineLimit(1)
                }

                Spacer()

                if isHovered {
                    Button { store.toggleFavorite(id: note.id) } label: {
                        Image(systemName: note.isFavorite ? "star.fill" : "star")
                            .foregroundStyle(note.isFavorite ? .yellow : .secondary)
                    }
                    .buttonStyle(.plain)
                    .help(note.isFavorite ? "Remove from Favorites" : "Add to Favorites")

                    Button { showDeleteAlert = true } label: {
                        Image(systemName: "trash")
                            .foregroundStyle(.red)
                    }
                    .buttonStyle(.plain)
                    .help("Delete Note")
                }
            }
        }
        .padding(.horizontal, 14)
        .padding(.vertical, 9)
        .contentShape(Rectangle())
        .onHover { isHovered = $0 }
        .draggable(note.id)
        .contextMenu {
            Button(note.isFavorite ? "Remove from Favorites" : "Add to Favorites") {
                store.toggleFavorite(id: note.id)
            }
            Menu("Move to Folder") {
                Button("Uncategorized") {
                    store.moveNote(id: note.id, toFolder: nil)
                }
                if !store.folders.isEmpty { Divider() }
                ForEach(store.folders) { folder in
                    Button {
                        store.moveNote(id: note.id, toFolder: folder.id)
                    } label: {
                        HStack {
                            Text(folder.name)
                            if note.folderId == folder.id {
                                Spacer()
                                Image(systemName: "checkmark")
                            }
                        }
                    }
                }
            }
            Divider()
            Button("Delete", role: .destructive) { showDeleteAlert = true }
        }
        .alert("Delete Note", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                store.deleteNote(id: note.id)
            }
        } message: {
            Text("Permanently delete "\(note.title.isEmpty ? "Untitled Note" : note.title)"? This cannot be undone.")
        }
    }

    private func formattedDate(_ date: Date) -> String {
        let cal = Calendar.current
        if cal.isDateInToday(date) {
            return date.formatted(date: .omitted, time: .shortened)
        } else if cal.isDateInYesterday(date) {
            return "Yesterday"
        } else if let days = cal.dateComponents([.day], from: date, to: Date()).day, days < 7 {
            return date.formatted(.dateTime.weekday(.wide))
        } else {
            return date.formatted(date: .abbreviated, time: .omitted)
        }
    }
}
