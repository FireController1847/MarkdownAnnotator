export function save(key: string, text: string): void {
    localStorage.setItem(key, text);
}

export function load(key: string): string {
    return localStorage.getItem(key) || "";
}

export function clear(key: string): void {
    localStorage.removeItem(key);
}