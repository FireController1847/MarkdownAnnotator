import $ from "jquery";

let activeDropdown: JQuery<HTMLElement> | null = null;

function getActiveCloseCallback(): (() => void) | null {
    if (!activeDropdown) return null;
    const hideFn = activeDropdown.data("start-close") as (() => void) | undefined;
    return hideFn ?? null;
}

export function closeAllDropdownsSlow() {
    const cb = getActiveCloseCallback();
    if (cb) cb();
    activeDropdown = null;
}

export function initDropdowns() {
    $(".dropdown-container").each(function() {
        const $container = $(this as HTMLElement);
        const $button = $container.find("button").first();
        const $menu = $container.find(".dropdown-menu");

        let locked = false;
        let isOpen = false;
        let isClosing = false;
        let timer: number | null = null;

        function clearTimer() {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        }

        function immediateHide() {
            clearTimer();
            locked = false;
            isOpen = false;
            isClosing = false;

            $menu.css({
                transform: "",
                opacity: "",
                transition: "",
                pointerEvents: "auto"
            });
        }

        function startOpen() {
            if (isClosing) {
                isClosing = false;
                locked = false;
                clearTimer();
                $menu.css({
                    transition: "",
                    opacity: "1",
                    pointerEvents: "auto"
                });
            }

            if (locked) return;

            if (activeDropdown && activeDropdown[0] !== $container[0]) {
                const prevHide = activeDropdown.data("immediate-hide") as (() => void) | undefined;
                if (prevHide) prevHide();
            }

            activeDropdown = $container;
            $container.data("immediate-hide", immediateHide);

            clearTimer();
            locked = true;
            isClosing = false;

            $menu.css({
                pointerEvents: "none",
                transition: "",
                transform: "none",
                opacity: "1"
            });

            timer = window.setTimeout(() => {
                timer = null;
                locked = false;
                isOpen = true;
                $menu.css({
                    pointerEvents: "auto",
                    transition: ""
                });
            }, 200);
        }

        function startClose() {
            if (locked || !isOpen) return;

            clearTimer();
            locked = true;
            isClosing = true;

            $menu.css({
                pointerEvents: "none",
                transition: "opacity 1s",
                opacity: ""
            });

            timer = window.setTimeout(() => {
                timer = null;

                if (!isClosing) return;

                $menu.css({
                    transform: "",
                    pointerEvents: "auto",
                    transition: ""
                });

                locked = false;
                isClosing = false;
                isOpen = false;
            }, 1000);
        }

        function closeAllSlow() {
            const cb = getActiveCloseCallback();
            if (cb) cb();
            activeDropdown = null;
        }

        $container.data("start-close", startClose);

        $container.on("mouseenter", startOpen);
        $container.on("mouseleave", startClose);
        $button.on("focus", startOpen);
        $button.on("blur", startClose);

        $(document).on("mousedown", function(e) {
            if (!activeDropdown) return;
            if ($(e.target).closest(".dropdown-menu").length > 0) return;
            if (activeDropdown && $(e.target).closest(activeDropdown).length > 0) return;
            closeAllSlow();
        });

        $(document).on("mouseleave", function() {
            const cb = getActiveCloseCallback();
            if (cb) cb();
            activeDropdown = null;
        });

        $(window).on("blur", function() {
            const cb = getActiveCloseCallback();
            if (cb) cb();
            activeDropdown = null;
        });
    });
}
