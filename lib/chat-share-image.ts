const SHARE_CONTROLS = [
    ".chat-multi-select-check",
    ".ctx-menu",
    ".offline-ob-progress-badge",
    ".chat-offline-menu-trigger",
    ".chat-reasoning-trigger",
    "[data-share-control]",
].join(", ");

async function inlineImage(url: string): Promise<string> {
    const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("图片读取失败");
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export async function createChatShareImage(rows: HTMLElement[], width: number): Promise<Blob> {
    await document.fonts.ready;
    const root = document.createElement("div");
    root.setAttribute("xmlns", "http://www.w3.org/1999/xhtml");
    root.style.cssText = "box-sizing:border-box;display:flex;flex-direction:column;gap:16px;padding:16px;background:#f3f4f6;overflow:hidden";
    root.style.width = `${width}px`;
    const images: Promise<void>[] = [];
    const cachedImages = new Map<string, Promise<string>>();
    const pseudoRules: string[] = [];

    function cloneStyles(source: Element, copy: Element, deep = true) {
        if (source.matches(SHARE_CONTROLS)) {
            copy.remove();
            return;
        }
        const computed = getComputedStyle(source);
        const style = (copy as HTMLElement | SVGElement).style;
        if (style) {
            for (const key of computed) style.setProperty(key, computed.getPropertyValue(key));
            style.animation = "none";
            style.transition = "none";
        }
        for (const pseudo of ["::before", "::after"]) {
            const computedPseudo = getComputedStyle(source, pseudo);
            if (["none", "normal"].includes(computedPseudo.content)) continue;
            const key = copy.getAttribute("data-export-pseudo") || String(pseudoRules.length);
            copy.setAttribute("data-export-pseudo", key);
            const declarations = Array.from(computedPseudo, property => `${property}:${computedPseudo.getPropertyValue(property)};`);
            pseudoRules.push(`[data-export-pseudo="${key}"]${pseudo}{${declarations.join("")}animation:none;transition:none;}`);
        }
        if (source instanceof HTMLImageElement && copy instanceof HTMLImageElement) {
            const url = source.currentSrc || source.src;
            copy.loading = "eager";
            copy.removeAttribute("srcset");
            copy.removeAttribute("src");
            if (url) {
                const data = cachedImages.get(url) || inlineImage(url);
                cachedImages.set(url, data);
                images.push(data.then(src => { copy.src = src; }, () => {
                    copy.remove();
                }));
            }
        }
        if (!deep) return;
        const children = Array.from(copy.children);
        Array.from(source.children).forEach((child, index) => {
            const target = children[index];
            if (target) cloneStyles(child, target);
        });
    }

    for (const row of rows) {
        const clone = row.cloneNode(true) as HTMLElement;
        const selectionAttributes = ["data-multi-select", "data-selected", "aria-checked"];
        const selectionValues = selectionAttributes.map(attribute => row.getAttribute(attribute));
        selectionAttributes.forEach(attribute => row.removeAttribute(attribute));
        try {
            cloneStyles(row, clone);
        } finally {
            selectionAttributes.forEach((attribute, index) => {
                const value = selectionValues[index];
                if (value !== null) row.setAttribute(attribute, value);
            });
        }
        selectionAttributes.forEach(attribute => clone.removeAttribute(attribute));
        clone.style.width = "100%";
        clone.style.maxWidth = "100%";
        clone.style.height = "auto";
        clone.style.margin = "0";
        if (row.parentElement?.matches(".chat-offline-turn")) {
            const card = row.parentElement.cloneNode(false) as HTMLElement;
            cloneStyles(row.parentElement, card, false);
            card.style.width = "100%";
            card.style.height = "auto";
            card.style.margin = "0";
            clone.style.borderTop = "none";
            card.append(clone);
            root.append(card);
        } else {
            root.append(clone);
        }
    }

    const style = document.createElement("style");
    style.textContent = pseudoRules.map(rule => `[data-chat-share-render] ${rule}`).join("\n");
    root.setAttribute("data-chat-share-render", "");
    root.prepend(style);
    await Promise.all(images);
    await Promise.all(Array.from(root.querySelectorAll("img"), image => image.decode().catch(() => image.remove())));
    root.style.position = "fixed";
    root.style.left = "-10000px";
    document.body.append(root);
    const bounds = root.getBoundingClientRect();
    const height = Math.ceil(bounds.height);
    // WebKit may omit nested images while rasterizing an SVG foreignObject.
    const avatars = Array.from(root.querySelectorAll<HTMLImageElement>(".chat-msg-avatar img, .chat-offline-avatar img"))
        .flatMap(image => {
            const rect = image.getBoundingClientRect();
            const computed = getComputedStyle(image);
            if (!rect.width || !rect.height || computed.visibility !== "visible") return [];
            const radius = computed.borderTopLeftRadius !== "0px"
                ? computed.borderTopLeftRadius
                : getComputedStyle(image.parentElement!).borderTopLeftRadius;
            const corner = (parseFloat(radius) || 0) * (radius.endsWith("%") ? Math.min(rect.width, rect.height) / 100 : 1);
            image.style.visibility = "hidden";
            return [{ image, rect, corner, fit: computed.objectFit, opacity: Number(computed.opacity) }];
        });
    root.remove();
    root.style.position = "";
    root.style.left = "";

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject width="100%" height="100%">${new XMLSerializer().serializeToString(root)}</foreignObject></svg>`;
    const image = new Image();
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    await image.decode();
    const canvas = document.createElement("canvas");
    const scale = Math.min(2, 1024 / width, 12000 / height);
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法生成长图");
    context.fillStyle = "#f3f4f6";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    context.scale(canvas.width / width, canvas.height / height);
    for (const { image, rect, corner, fit, opacity } of avatars) {
        const x = rect.left - bounds.left;
        const y = rect.top - bounds.top;
        const ratios = [rect.width / image.naturalWidth, rect.height / image.naturalHeight];
        const factor = fit === "contain" ? Math.min(...ratios) : Math.max(...ratios);
        const drawWidth = fit === "fill" ? rect.width : image.naturalWidth * factor;
        const drawHeight = fit === "fill" ? rect.height : image.naturalHeight * factor;
        context.save();
        context.globalAlpha = opacity;
        context.beginPath();
        context.roundRect(x, y, rect.width, rect.height, corner);
        context.clip();
        context.drawImage(image, x + (rect.width - drawWidth) / 2, y + (rect.height - drawHeight) / 2, drawWidth, drawHeight);
        context.restore();
    }
    return new Promise((resolve, reject) => {
        canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("无法导出 JPG")), "image/jpeg", 0.88);
    });
}
