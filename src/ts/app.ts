import { Parser, HtmlRenderer } from "commonmark";
import { EditorView, basicSetup } from "codemirror";
import { markdown } from "@codemirror/lang-markdown";
import { placeholder } from "@codemirror/view";
import EmojiParser from "universal-emoji-parser";
import hljs from "highlight.js/lib/common";
import "highlight.js/styles/github.css";
import $ from "jquery";
import { save, load } from "./storage";

const PREVIEW_STORAGE_KEY = "markdown-editor-preview";
const SPLIT_STORAGE_KEY = "markdown-editor-split";
const CONTENT_STORAGE_KEY = "markdown-editor-content";

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

    $("#toggle-preview").on("change", function() {
        const enabled = $(this).is(":checked");
        controlTogglePreview(enabled);
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

function initEditor(parser: Parser, renderer: HtmlRenderer, $preview: JQuery<HTMLElement>) {
    const $editor = $("#editor");

    const view = new EditorView({
        parent: $editor[0],
        doc: "",
        extensions: [
            basicSetup,
            markdown(),
            placeholder("Begin typing your markdown here..."),
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

    initControls();
    initSplit();
    initPreviewToggle();
    initEditor(parser, renderer, $preview);
}

$(main);