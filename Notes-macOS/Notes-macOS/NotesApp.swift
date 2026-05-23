import SwiftUI

@main
struct NotesApp: App {
    @StateObject private var store = NotesStore()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(store)
                .frame(minWidth: 820, minHeight: 520)
        }
        .windowStyle(.titleBar)
        .windowToolbarStyle(.unified(showsTitle: false))
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("New Note") { store.createNote() }
                    .keyboardShortcut("n", modifiers: .command)
            }
            SidebarCommands()
            CommandGroup(after: .pasteboard) {
                Divider()
                Button("Toggle Focus Mode") { store.isDistractionFree.toggle() }
                    .keyboardShortcut("f", modifiers: [.command, .shift])
            }
        }
    }
}
