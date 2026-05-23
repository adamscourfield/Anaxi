import SwiftUI
import AppKit

struct EditorView: View {
    @EnvironmentObject var store: NotesStore

    private var note: Note? {
        guard let id = store.selectedNoteId else { return nil }
        return store.notes.first { $0.id == id }
    }

    var body: some View {
        if let note = note {
            NoteEditorView(note: note)
                .id(note.id)   // forces full rebuild when note switches
        } else {
            EmptyEditorPlaceholder()
        }
    }
}

// MARK: – Empty state

private struct EmptyEditorPlaceholder: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "square.and.pencil")
                .font(.system(size: 48, weight: .ultraLight))
                .foregroundStyle(.quaternary)
            Text("No Note Selected")
                .font(.title3.bold())
                .foregroundStyle(.secondary)
            Text("Create a new note or select one from the list.")
                .font(.callout)
                .foregroundStyle(.tertiary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(NSColor.textBackgroundColor))
    }
}

// MARK: – Editor

private struct NoteEditorView: View {
    @EnvironmentObject var store: NotesStore
    let note: Note

    @State private var titleText: String = ""
    @State private var saveStatus = "Saved"
    @State private var saveStatusOpacity: Double = 1
    @State private var showDeleteAlert = false
    @State private var copied = false
    @FocusState private var titleFocused: Bool

    var body: some View {
        VStack(spacing: 0) {
            // Formatting toolbar
            formattingBar

            Divider()

            // Scrollable writing area
            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    // Title
                    TextField("Title", text: $titleText)
                        .font(.system(size: 26, weight: .bold, design: .default))
                        .textFieldStyle(.plain)
                        .focused($titleFocused)
                        .padding(.horizontal, 40)
                        .padding(.top, 32)
                        .padding(.bottom, 16)
                        .onChange(of: titleText) { newVal in
                            store.updateNote(id: note.id, title: newVal)
                            flashSaved()
                        }

                    // Rich text editor
                    RichTextEditor(
                        noteId: note.id,
                        initialRTF: note.attributedContent,
                        onTextChange: { plain, rtf in
                            store.updateNote(id: note.id, content: plain, attributedContent: rtf)
                            flashSaved()
                        }
                    )
                    .id(note.id)  // new NSTextView on each note switch
                    .frame(minHeight: 420)
                    .padding(.horizontal, 40)
                    .padding(.bottom, 40)
                }
            }
            .background(Color(NSColor.textBackgroundColor))

            Divider()

            // Stats footer
            statsFooter
        }
        .background(Color(NSColor.textBackgroundColor))
        .onAppear { titleText = note.title }
        .toolbar { toolbarItems }
        .alert("Delete Note", isPresented: $showDeleteAlert) {
            Button("Cancel", role: .cancel) {}
            Button("Delete", role: .destructive) {
                store.deleteNote(id: note.id)
            }
        } message: {
            Text("Permanently delete "\(note.title.isEmpty ? "Untitled Note" : note.title)"? This cannot be undone.")
        }
    }

    // MARK: – Subviews

    private var formattingBar: some View {
        HStack(spacing: 2) {
            formatButton("B", font: .system(size: 13, weight: .bold),   command: "bold:",   help: "Bold (⌘B)")
            formatButton("I", font: .system(size: 13).italic(),         command: "italic:", help: "Italic (⌘I)")
            underlineButton

            Divider().frame(height: 16).padding(.horizontal, 4)

            Text("⌘B · ⌘I · ⌘U")
                .font(.system(size: 10, design: .monospaced))
                .foregroundStyle(.quaternary)

            Spacer()

            if let folderId = note.folderId, let folder = store.folder(for: folderId) {
                Label(folder.name, systemImage: "folder")
                    .font(.system(size: 11))
                    .foregroundStyle(.tertiary)
            }
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color(NSColor.windowBackgroundColor))
    }

    private func formatButton(_ label: String, font: Font, command: String, help: String) -> some View {
        Button(label) {
            NSApp.sendAction(Selector(command), to: nil, from: nil)
        }
        .font(font)
        .buttonStyle(.plain)
        .frame(width: 28, height: 24)
        .background(Color.secondary.opacity(0.08))
        .cornerRadius(5)
        .help(help)
    }

    private var underlineButton: some View {
        Button("U") {
            NSApp.sendAction(Selector("underline:"), to: nil, from: nil)
        }
        .font(.system(size: 13).underline())
        .buttonStyle(.plain)
        .frame(width: 28, height: 24)
        .background(Color.secondary.opacity(0.08))
        .cornerRadius(5)
        .help("Underline (⌘U)")
    }

    private var statsFooter: some View {
        HStack(spacing: 16) {
            Text("\(note.wordCount) \(note.wordCount == 1 ? "word" : "words")")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.tertiary)
            Text("\(note.charCount) \(note.charCount == 1 ? "character" : "characters")")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.tertiary)
            Spacer()
            Label("~\(note.readingTimeMinutes) min read", systemImage: "book")
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 7)
        .background(Color(NSColor.windowBackgroundColor))
    }

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .navigation) {
            Button {
                store.isDistractionFree.toggle()
            } label: {
                Label(
                    store.isDistractionFree ? "Show Sidebar" : "Focus Mode",
                    systemImage: store.isDistractionFree ? "sidebar.left" : "arrow.up.left.and.arrow.down.right"
                )
            }
            .help(store.isDistractionFree ? "Show Sidebar" : "Focus Mode")
        }

        ToolbarItem {
            Text(saveStatus)
                .font(.system(size: 11, design: .monospaced))
                .foregroundStyle(.tertiary)
                .opacity(saveStatusOpacity)
        }

        ToolbarItem {
            Button {
                store.toggleFavorite(id: note.id)
            } label: {
                Label(
                    note.isFavorite ? "Unfavorite" : "Favorite",
                    systemImage: note.isFavorite ? "star.fill" : "star"
                )
            }
            .foregroundStyle(note.isFavorite ? .yellow : .secondary)
            .help(note.isFavorite ? "Remove from Favorites" : "Add to Favorites")
        }

        ToolbarItem {
            Button {
                copyToClipboard()
            } label: {
                Label("Copy", systemImage: copied ? "checkmark" : "doc.on.doc")
            }
            .foregroundStyle(copied ? .green : .secondary)
            .help("Copy as Plain Text")
        }

        ToolbarItem {
            Button { exportNote() } label: {
                Label("Export", systemImage: "arrow.down.doc")
            }
            .help("Export as Markdown")
        }

        ToolbarItem {
            Divider()
        }

        ToolbarItem {
            Button(role: .destructive) {
                showDeleteAlert = true
            } label: {
                Label("Delete", systemImage: "trash")
            }
            .foregroundStyle(.red)
            .help("Delete Note")
        }
    }

    // MARK: – Actions

    private func flashSaved() {
        saveStatus = "Saved"
        saveStatusOpacity = 1
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.5) {
            withAnimation(.easeOut(duration: 0.8)) { saveStatusOpacity = 0 }
        }
    }

    private func copyToClipboard() {
        let text = "# \(note.title)\n\n\(note.content)"
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(text, forType: .string)
        copied = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 2) { copied = false }
    }

    private func exportNote() {
        let panel = NSSavePanel()
        panel.allowedContentTypes = [.text]
        panel.nameFieldStringValue = "\(note.title.isEmpty ? "untitled" : note.title).md"
        panel.begin { response in
            guard response == .OK, let url = panel.url else { return }
            let content = "# \(note.title)\n\n\(note.content)"
            try? content.write(to: url, atomically: true, encoding: .utf8)
        }
    }
}
