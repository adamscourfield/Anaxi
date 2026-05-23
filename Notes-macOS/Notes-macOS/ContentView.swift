import SwiftUI

struct ContentView: View {
    @EnvironmentObject var store: NotesStore
    @State private var columnVisibility: NavigationSplitViewVisibility = .all

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 170, ideal: 220, max: 280)
        } content: {
            NoteListView()
                .navigationSplitViewColumnWidth(min: 220, ideal: 290, max: 380)
        } detail: {
            EditorView()
        }
        .onChange(of: store.isDistractionFree) { distractionFree in
            withAnimation {
                columnVisibility = distractionFree ? .detailOnly : .all
            }
        }
        .onChange(of: columnVisibility) { vis in
            store.isDistractionFree = (vis == .detailOnly)
        }
    }
}
