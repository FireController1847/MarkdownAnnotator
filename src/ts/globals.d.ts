declare global {
    interface Window {
        $: JQueryStatic;
        jQuery: JQueryStatic;
    }
    const __APP_VERSION__: string;
    const __APP_DESCRIPTION__: string;
    const __APP_AUTHOR__: string;
    const __APP_LICENSE__: string;
}

export {};