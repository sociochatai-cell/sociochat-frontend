/** Clear SocioChat user session keys from storage. */
export function clearAllUserData() {
    const lsKeys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('sv_') || key.startsWith('sociochat_'))) lsKeys.push(key);
    }
    lsKeys.forEach(k => localStorage.removeItem(k));

    const ssKeys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key && (key.startsWith('sv_') || key.startsWith('sociochat_'))) ssKeys.push(key);
    }
    ssKeys.forEach(k => sessionStorage.removeItem(k));
}
