import { Parser, HtmlRenderer } from "commonmark";
import { EditorView, basicSetup } from "codemirror";
import { Compartment } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { placeholder } from "@codemirror/view";
import EmojiParser from "universal-emoji-parser";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github.css";
import $ from "jquery";

import { save, load } from "./storage";
import { initDropdowns } from "./dropdown";

const PREVIEW_STORAGE_KEY = "markdown-editor-preview";
const WORD_WRAP_STORAGE_KEY = "markdown-editor-wordwrap";
const SPLIT_STORAGE_KEY = "markdown-editor-split";
const CONTENT_STORAGE_KEY = "markdown-editor-content";

const wordWrapCompartment = new Compartment();

window.$ = $;
window.jQuery = $;

function updatePreview(view: EditorView, parser: Parser, renderer: HtmlRenderer, $preview: JQuery<HTMLElement>) {
    let text = view.state.doc.toString();
    text = EmojiParser.parseToUnicode(text);
    const parsed = parser.parse(text);
    const html = renderer.render(parsed);
    $preview.html(html);
    $preview.find("pre code").each((_, block) => {
        hljs.highlightElement(block as HTMLElement);
    });
}

function controlTogglePreview(enabled: boolean) {
    if (enabled) {
        $("#preview").show();
        $("#divider").show();
        save(PREVIEW_STORAGE_KEY, "true");
    } else {
        $("#preview").hide();
        $("#divider").hide();
        save(PREVIEW_STORAGE_KEY, "false");
    }
}

function controlToggleWordWrap(enabled: boolean) {
    const $preview = $("#preview");
    const view = (EditorView as any).findFromDOM(document.getElementById("editor"));
    if (enabled) {
        view.dispatch({
            effects: wordWrapCompartment.reconfigure(EditorView.lineWrapping)
        });
        save(WORD_WRAP_STORAGE_KEY, "true");
    } else {
        view.dispatch({
            effects: wordWrapCompartment.reconfigure([])
        });
        save(WORD_WRAP_STORAGE_KEY, "false");
    }
}

function controlDragDivider(pageX: number, deltaX: number) {
    const $editor = $("#editor");
    const $divider = $("#divider");
    const $preview = $("#preview");

    const divX = pageX - deltaX;
    const editorBasis = (divX / $("body").width()!) * 100;
    const dividerWidth = $divider.width()!;
    const dividerBasis = editorBasis - (dividerWidth / $("body").width()!) * 100 / 2;
    const previewBasis = 100 - editorBasis;

    $editor.css("flex-basis", `${editorBasis}%`);
    $divider.css("left", `${dividerBasis}%`);
    $preview.css("flex-basis", `${previewBasis}%`);

    const middle = $("body").width()! / 2;
    const offsetFromMiddle = divX - middle;
    save(SPLIT_STORAGE_KEY, offsetFromMiddle.toString());
}

function initControls() {
    let target: JQuery | null = null;
    let dragging: boolean = false;
    let dragX: number = 0;
    let dragY: number = 0;

    $("body").on("mousemove", function(e) {
        if (dragging && target) {
            if (target[0].id == "divider") {
                // Snap when close to 50%
                if (Math.abs(e.pageX - $("body").width()! / 2) < 7) {
                    e.pageX = $("body").width()! / 2;
                }
                controlDragDivider(dragX, e.pageX - dragX);
            }
            dragX = e.pageX;
            dragY = e.pageY;
        }
    });

    $("body").on("mouseup", function() {
        dragging = false;
        $("body").css("user-select", "auto");
        $("body").css("cursor", "auto");
    });

    $("#divider").on("mousedown", function(e) {
        target = $(this);
        dragging = true;
        dragX = e.pageX;
        dragY = e.pageY;
        $("body").css("user-select", "none");
        $("body").css("cursor", "ew-resize");
    });

    $("#divider").on("dblclick", function(e) {
        e.preventDefault();

        const $editor = $("#editor");
        const $preview = $("#preview");
        const $divider = $("#divider");

        const middle = $("body").width()! / 2;

        // Reset basis to 50 / 50
        $editor.css("flex-basis", "50%");
        $preview.css("flex-basis", "50%");

        // Center the divider
        const dividerWidth = $divider.width()!;
        const dividerBasis = 50 - ((dividerWidth / $("body").width()!) * 100 / 2);
        $divider.css("left", `${dividerBasis}%`);

        // Save "0" offset (perfectly centered)
        save(SPLIT_STORAGE_KEY, "0");
    });

    $("#toggle-preview").on("change", function() {
        const enabled = $(this).is(":checked");
        controlTogglePreview(enabled);
    });

    $("#toggle-word-wrap").on("change", function() {
        const enabled = $(this).is(":checked");
        controlToggleWordWrap(enabled);
    });

    $("#new-button").on("click", function() {
        if (confirm("Are you sure you want to create a new file? Unsaved changes will be lost.")) {
            save(CONTENT_STORAGE_KEY, "");
            location.reload();
        }
    });

    $("#save-button").on("click", async function () {
        console.log("Save button clicked");
        const content = load(CONTENT_STORAGE_KEY);
        const suggestedName = "document.md";

        // If browser supports File System Access API
        if ("showSaveFilePicker" in window) {
            console.log("Using File System Access API to save file");
            try {
                const handle = await (window as any).showSaveFilePicker({
                    suggestedName,
                    types: [
                        {
                            description: "Markdown File",
                            accept: { "text/markdown": [".md"] }
                        }
                    ]
                });

                const writable = await handle.createWritable();
                await writable.write(content);
                await writable.close();

                console.log("File saved successfully");
                return;
            } catch (err) {
                console.warn("User cancelled or error:", err);
                return;
            }
        }

        // FALLBACK (Firefox, Safari, older browsers)
        const blob = new Blob([content], {
            type: "text/markdown;charset=utf-8"
        });

        let filename = prompt("Enter a filename:", suggestedName);
        if (!filename) {
            console.log("Save cancelled by user.");
            return;
        }
        if (!filename.endsWith(".md")) {
            filename += ".md";
        }

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = filename;  // Suggests filename in the save dialog

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        URL.revokeObjectURL(url);

        console.log("Saved using fallback download");
    });

    $("#open-button").on("click", async function () {
        console.log("Open button clicked");

        // If modified, warn user
        const currentContent = load(CONTENT_STORAGE_KEY);
        if (currentContent.length > 0) {
            const proceed = confirm("Opening a new file will replace the current content. Unsaved changes will be lost. Continue?");
            if (!proceed) {
                console.log("Open cancelled by user.");
                return;
            }
        }

        // If browser supports File System Access API
        if ("showOpenFilePicker" in window) {
            console.log("Using File System Access API to open file");
            try {
                const [handle] = await (window as any).showOpenFilePicker({
                    types: [
                        {
                            description: "Markdown File",
                            accept: { "text/markdown": [".md"] }
                        }
                    ],
                    multiple: false
                });

                const file = await handle.getFile();
                const content = await file.text();

                save(CONTENT_STORAGE_KEY, content);
                location.reload();

                console.log("File opened successfully");
                return;
            } catch (err) {
                console.warn("User cancelled or error:", err);
                return;
            }
        }

        // FALLBACK (Firefox, Safari, older browsers)
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".md,text/markdown";

        input.onchange = e => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) {
                console.log("No file selected");
                return;
            }

            const reader = new FileReader();
            reader.onload = function(e) {
                const content = e.target?.result;
                if (typeof content === "string") {
                    save(CONTENT_STORAGE_KEY, content);
                    location.reload();
                    console.log("File opened using fallback method");
                }
            };
            reader.readAsText(file);
        };

        input.click();
    });

    $("#github-button").on("click", function() {
        window.open("https://github.com/FireController1847/MarkdownAnnotator/");
    });

    $("#about-button").on("click", function() {
        alert("MarkdownAnnotator v" + __APP_VERSION__ + "\n\n" + __APP_DESCRIPTION__ + "\n\nCopyright © 2025 " + __APP_AUTHOR__ + ".\n\nLicensed under the " + __APP_LICENSE__ + " License.");
    });

}

function initSplit() {
    controlDragDivider($("body").width()! / 2, -parseFloat(load(SPLIT_STORAGE_KEY)));
}

function initPreviewToggle() {
    const previewEnabled = load(PREVIEW_STORAGE_KEY) !== "false";
    $("#toggle-preview").prop("checked", previewEnabled);
    controlTogglePreview(previewEnabled);
}

function initWordWrapToggle() {
    const wordWrapEnabled = load(WORD_WRAP_STORAGE_KEY) !== "false";
    $("#toggle-word-wrap").prop("checked", wordWrapEnabled);
    controlToggleWordWrap(wordWrapEnabled);
}

function initEditor(parser: Parser, renderer: HtmlRenderer, $preview: JQuery<HTMLElement>) {
    const $editor = $("#editor");

    const view = new EditorView({
        parent: $editor[0],
        doc: "",
        extensions: [
            basicSetup,
            markdown(),
            placeholder("Begin typing your markdown here..."),
            wordWrapCompartment.of(EditorView.lineWrapping),
            EditorView.updateListener.of(update => {
                if (update.docChanged) {
                    updatePreview(view, parser, renderer, $preview);
                    save(CONTENT_STORAGE_KEY, view.state.doc.toString());
                }
            })
        ]
    });

    const initial = load(CONTENT_STORAGE_KEY);
    view.dispatch({ changes: { from: 0, to: 0, insert: initial } });

    updatePreview(view, parser, renderer, $preview);

    return view;
}

function main() {
    const $preview = $("#preview");

    const parser = new Parser();
    const renderer = new HtmlRenderer();

    initEditor(parser, renderer, $preview);
    initControls();
    initSplit();
    initDropdowns();
    initPreviewToggle();
    initWordWrapToggle();
}

$(main);