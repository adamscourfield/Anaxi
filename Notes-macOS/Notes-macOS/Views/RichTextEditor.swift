import SwiftUI
import AppKit

struct RichTextEditor: NSViewRepresentable {
    let noteId: String
    let initialRTF: Data?
    var onTextChange: (String, Data?) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(self)
    }

    func makeNSView(context: Context) -> NSScrollView {
        let scrollView = NSTextView.scrollableTextView()
        guard let textView = scrollView.documentView as? NSTextView else { return scrollView }

        textView.delegate = context.coordinator
        textView.isEditable = true
        textView.isSelectable = true
        textView.allowsUndo = true
        textView.isRichText = true
        textView.usesFontPanel = true
        textView.usesRuler = false
        textView.isAutomaticQuoteSubstitutionEnabled = false
        textView.isAutomaticDashSubstitutionEnabled = false
        textView.isAutomaticSpellingCorrectionEnabled = false
        textView.isContinuousSpellCheckingEnabled = true
        textView.backgroundColor = .clear
        textView.drawsBackground = false
        textView.textContainerInset = NSSize(width: 0, height: 4)
        textView.font = NSFont.systemFont(ofSize: 15)
        textView.typingAttributes = defaultTypingAttributes()

        scrollView.hasVerticalScroller = false
        scrollView.hasHorizontalScroller = false
        scrollView.drawsBackground = false
        scrollView.backgroundColor = .clear

        context.coordinator.textView = textView
        context.coordinator.currentNoteId = noteId
        loadContent(into: textView)

        return scrollView
    }

    func updateNSView(_ scrollView: NSScrollView, context: Context) {
        guard let textView = scrollView.documentView as? NSTextView else { return }
        // Only reload when note switches – not while the user types
        guard context.coordinator.currentNoteId != noteId else { return }
        context.coordinator.currentNoteId = noteId
        loadContent(into: textView)
    }

    private func loadContent(into textView: NSTextView) {
        if let data = initialRTF,
           let attrStr = NSAttributedString(rtf: data, documentAttributes: nil) {
            textView.textStorage?.setAttributedString(attrStr)
        } else {
            textView.textStorage?.setAttributedString(NSAttributedString(string: ""))
        }
        textView.typingAttributes = defaultTypingAttributes()
        textView.undoManager?.removeAllActions()
    }

    private func defaultTypingAttributes() -> [NSAttributedString.Key: Any] {
        [
            .font: NSFont.systemFont(ofSize: 15),
            .foregroundColor: NSColor.textColor,
            .paragraphStyle: {
                let style = NSMutableParagraphStyle()
                style.lineSpacing = 4
                return style
            }()
        ]
    }

    // MARK: – Coordinator

    class Coordinator: NSObject, NSTextViewDelegate {
        var parent: RichTextEditor
        var currentNoteId: String = ""
        weak var textView: NSTextView?

        init(_ parent: RichTextEditor) {
            self.parent = parent
        }

        func textDidChange(_ notification: Notification) {
            guard let tv = notification.object as? NSTextView else { return }
            let plain = tv.string
            let rtf = tv.textStorage?.rtf(
                from: NSRange(location: 0, length: tv.textStorage?.length ?? 0),
                documentAttributes: [.documentType: NSAttributedString.DocumentType.rtf]
            )
            parent.onTextChange(plain, rtf)
        }
    }
}
