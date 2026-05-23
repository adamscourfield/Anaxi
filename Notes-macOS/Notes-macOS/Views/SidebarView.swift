import SwiftUI

struct SidebarView: View {
    @EnvironmentObject var store: NotesStore
    @State private var isCreatingFolder = false
    @State private var newFolderName = ""
    @State private var editingFolderId: String? = nil
    @State private var editingName = ""
    @State private var folderToDelete: Folder? = nil
    @FocusState private var newFolderFocused: Bool
    @FocusState private var editingFolderFocused: Bool

    var body: some View {
        List(selection: Binding(
            get: { store.selectedFilter },
            set: { store.selectedFilter = $0; store.selectFirstVisibleNote() }
        )) {
            Section("Workspace") {
                smartRow(.all,           label: "All Notes",     icon: "tray.2")
                smartRow(.favorites,     label: "Favorites",     icon: "star")
                smartRow(.uncategorized, label: "Uncategorized", icon: "tray")
            }

            Section {
                if isCreatingFolder {
                    newFolderRow
                }
                ForEach(store.folders) { folder in
                    folderRow(folder)
                }
            } header: {
                HStack {
                    Text("Folders")
                    Spacer()
                    Button { startCreatingFolder() } label: {
                        Image(systemName: "plus")
                            .font(.system(size: 11))
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.secondary)
                    .help("New Folder")
                }
            }
        }
        .listStyle(.sidebar)
        .alert("Delete Folder", isPresented: Binding(
            get: { folderToDelete != nil },
            set: { if !$0 { folderToDelete = nil } }
        )) {
            Button("Cancel", role: .cancel) { folderToDelete = nil }
            Button("Delete", role: .destructive) {
                if let f = folderToDelete { store.deleteFolder(id: f.id) }
                folderToDelete = nil
            }
        } message: {
            if let f = folderToDelete {
                Text("Delete "\(f.name)"? Notes inside will be moved to Uncategorized.")
            }
        }
    }

    // MARK: – Smart rows

    @ViewBuilder
    private func smartRow(_ filter: SidebarFilter, label: String, icon: String) -> some View {
        Label {
            HStack {
                Text(label)
                Spacer()
                Text("\(store.noteCount(for: filter))")
                    .font(.system(size: 11, design: .monospaced))
                    .foregroundStyle(.tertiary)
            }
        } icon: {
            Image(systemName: icon)
        }
        .tag(filter)
        .dropDestination(for: String.self) { items, _ in
            guard let noteId = items.first else { return false }
            switch filter {
            case .uncategorized: store.moveNote(id: noteId, toFolder: nil)
            default: break
            }
            return true
        }
    }

    // MARK: – Folder rows

    @ViewBuilder
    private func folderRow(_ folder: Folder) -> some View {
        if editingFolderId == folder.id {
            HStack(spacing: 6) {
                Image(systemName: "folder")
                    .foregroundStyle(.secondary)
                    .font(.system(size: 13))
                TextField("Folder name", text: $editingName)
                    .textFieldStyle(.plain)
                    .focused($editingFolderFocused)
                    .onSubmit { commitRename(folder.id) }
                    .onExitCommand { editingFolderId = nil }
                Button { commitRename(folder.id) } label: {
                    Image(systemName: "checkmark").foregroundStyle(.green)
                }.buttonStyle(.plain)
                Button { editingFolderId = nil } label: {
                    Image(systemName: "xmark").foregroundStyle(.secondary)
                }.buttonStyle(.plain)
            }
        } else {
            Label {
                HStack {
                    Text(folder.name)
                    Spacer()
                    Text("\(store.noteCount(for: .folder(id: folder.id)))")
                        .font(.system(size: 11, design: .monospaced))
                        .foregroundStyle(.tertiary)
                }
            } icon: {
                Image(systemName: "folder")
            }
            .tag(SidebarFilter.folder(id: folder.id))
            .contextMenu {
                Button("Rename") { startEditing(folder) }
                Divider()
                Button("Delete", role: .destructive) { folderToDelete = folder }
            }
            .dropDestination(for: String.self) { items, _ in
                guard let noteId = items.first else { return false }
                store.moveNote(id: noteId, toFolder: folder.id)
                return true
            }
        }
    }

    // MARK: – New folder row

    private var newFolderRow: some View {
        HStack(spacing: 6) {
            Image(systemName: "folder.badge.plus")
                .foregroundStyle(.secondary)
                .font(.system(size: 13))
            TextField("New folder…", text: $newFolderName)
                .textFieldStyle(.plain)
                .focused($newFolderFocused)
                .onSubmit { submitNewFolder() }
                .onExitCommand { cancelNewFolder() }
            Button { submitNewFolder() } label: {
                Image(systemName: "checkmark").foregroundStyle(.green)
            }.buttonStyle(.plain)
            Button { cancelNewFolder() } label: {
                Image(systemName: "xmark").foregroundStyle(.secondary)
            }.buttonStyle(.plain)
        }
    }

    // MARK: – Actions

    private func startCreatingFolder() {
        isCreatingFolder = true
        newFolderName = ""
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { newFolderFocused = true }
    }

    private func submitNewFolder() {
        let name = newFolderName.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty { store.createFolder(name: name) }
        newFolderName = ""
        isCreatingFolder = false
    }

    private func cancelNewFolder() {
        newFolderName = ""
        isCreatingFolder = false
    }

    private func startEditing(_ folder: Folder) {
        editingFolderId = folder.id
        editingName = folder.name
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.05) { editingFolderFocused = true }
    }

    private func commitRename(_ id: String) {
        let name = editingName.trimmingCharacters(in: .whitespaces)
        if !name.isEmpty { store.renameFolder(id: id, name: name) }
        editingFolderId = nil
    }
}
