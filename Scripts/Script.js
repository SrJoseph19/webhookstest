document.addEventListener('DOMContentLoaded', function() {
    // Elementos del DOM
    const categorySelector = document.getElementById('categorySelector');
    const addCategoryBtn = document.getElementById('addCategoryBtn');
    const categoryForm = document.getElementById('categoryForm');
    const categoryNameInput = document.getElementById('categoryName');
    const saveCategoryBtn = document.getElementById('saveCategoryBtn');
    const cancelCategoryBtn = document.getElementById('cancelCategoryBtn');
    const webhookSelector = document.getElementById('webhookSelector');
    const addWebhookBtn = document.getElementById('addWebhookBtn');
    const webhookForm = document.getElementById('webhookForm');
    const webhookNameInput = document.getElementById('webhookName');
    const webhookUrlInput = document.getElementById('webhookUrl');
    const saveWebhookBtn = document.getElementById('saveWebhookBtn');
    const cancelWebhookBtn = document.getElementById('cancelWebhookBtn');
    const currentCategoryDisplay = document.getElementById('currentCategoryDisplay');
    const currentWebhookDisplay = document.getElementById('currentWebhookDisplay');
    const fileInput = document.getElementById('fileInput');
    const uploadButton = document.getElementById('uploadButton');
    const responseDiv = document.getElementById('response');
    const previewContainer = document.getElementById('previewContainer');
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const importFileInput = document.getElementById('importFile');

// Estado de la aplicación
let categories = [];
let currentCategory = null;
let currentWebhook = null;
const CONFIG_FILE_NAME = 'DiscordWebhooks.txt';

// Variables para avatares
let leftAvatar = 'default';
let rightAvatar = 'default';
let leftCustomAvatar = null;
let rightCustomAvatar = null;
// Nuevo: array para manejar archivos seleccionados y permitir eliminarlos antes de subir
let selectedFiles = [];
// Track last background object URL so we can revoke it when changed
let _lastBackgroundObjectUrl = null;
    // IndexedDB helpers for storing avatar blobs
    const IDB_DB_NAME = 'webhookAvatars';
    const IDB_STORE_NAME = 'avatars';

    function openIdb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(IDB_DB_NAME, 1);
            req.onupgradeneeded = function(e) {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
                    db.createObjectStore(IDB_STORE_NAME);
                }
            };
            req.onsuccess = function(e) { resolve(e.target.result); };
            req.onerror = function(e) { reject(e.target.error); };
        });
    }

    async function idbPutBlob(key, blob) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.put(blob, key);
            req.onsuccess = () => { resolve(true); db.close(); };
            req.onerror = (e) => { reject(e.target.error); db.close(); };
        });
    }

    async function idbGetBlob(key) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readonly');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.get(key);
            req.onsuccess = (e) => { resolve(e.target.result); db.close(); };
            req.onerror = (e) => { reject(e.target.error); db.close(); };
        });
    }

    async function idbDelete(key) {
        const db = await openIdb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
            const store = tx.objectStore(IDB_STORE_NAME);
            const req = store.delete(key);
            req.onsuccess = () => { resolve(true); db.close(); };
            req.onerror = (e) => { reject(e.target.error); db.close(); };
        });
    }

    // Helper: detect whether an image File/Blob is animated (GIF, animated WebP, or APNG)
    // Returns a Promise<boolean>.
    function fileIsAnimated(file) {
        return new Promise(async (resolve) => {
            try {
                if (!file || !file.type) return resolve(false);
                const t = file.type.toLowerCase();
                if (t === 'image/gif') return resolve(true);

                // For WebP and PNG we need to inspect the binary for animation chunks
                const maxRead = Math.min(file.size, 16384); // read up to 16KB
                const blob = file.slice(0, maxRead);
                const ab = await blob.arrayBuffer();
                const bytes = new Uint8Array(ab);
                const text = new TextDecoder('latin1').decode(bytes);

                if (t === 'image/webp') {
                    // Animated WebP contains an 'ANIM' chunk
                    if (text.indexOf('ANIM') !== -1) return resolve(true);
                }

                if (t === 'image/png') {
                    // APNG has an 'acTL' chunk
                    if (text.indexOf('acTL') !== -1) return resolve(true);
                }

                // Fallback: not detected as animated
                return resolve(false);
            } catch (e) {
                // on error, assume not animated
                return resolve(false);
            }
        });
    }

    // Helper: convert image File to compressed Blob (resize and JPEG compress)
    // NOTE: Animated GIFs must NOT be rasterized via canvas because that flattens them
    // into a single-frame raster image; for GIFs we return the original File/Blob to
    // preserve animation in previews and when storing to IndexedDB.
    async function fileToCompressedBlob(file, maxWidth = 256, quality = 0.8) {
        if (!file) throw new Error('No file provided');
        if (!file.type || !file.type.startsWith('image/')) throw new Error('Not an image file');

        // Check animation first; if animated return original blob/file to preserve animation
        try {
            const animated = await fileIsAnimated(file);
            if (animated) return file;
        } catch (e) {
            // ignore and continue to compression
        }

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxWidth / img.width);
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    canvas.toBlob(blob => {
                        if (blob) resolve(blob);
                        else reject(new Error('Compression failed'));
                    }, 'image/jpeg', quality);
                };
                img.onerror = (err) => reject(err);
                img.src = reader.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // Funciones auxiliares
    function generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function showForm(form, show) {
        form.classList.toggle('hidden', !show);
    }

    function showNotification(message, isError = false) {
        responseDiv.textContent = message;
        responseDiv.style.color = isError ? '#ff4444' : '#44ff44';
        setTimeout(() => {
            responseDiv.textContent = '';
            responseDiv.style.color = '';
        }, 3000);
    }

    // Funciones para actualizar la UI
    function updateUI() {
        updateCategorySelector();
        updateWebhookSelector(currentCategory?.id);
        updateButtonStates();
        updateCurrentSelections();
        updateButtonTexts();
        updateWebhookAvatar();
        updateAppBackground();
    }

    // Set the app background (body) to the current webhook avatar when available
    function updateAppBackground() {
        const body = document.body;

        // helper to set and revoke previous objectURL
        const setBackground = (url, isObjectUrl = false) => {
            try {
                if (_lastBackgroundObjectUrl && _lastBackgroundObjectUrl !== url) {
                    try { URL.revokeObjectURL(_lastBackgroundObjectUrl); } catch (e) { /* ignore */ }
                    _lastBackgroundObjectUrl = null;
                }
            } catch (e) { /* ignore */ }

            if (url) {
                body.style.backgroundImage = `url("${url}")`;
                body.style.backgroundSize = 'cover';
                body.style.backgroundPosition = 'center center';
                body.style.backgroundRepeat = 'no-repeat';
            } else {
                body.style.backgroundImage = '';
            }

            if (isObjectUrl) _lastBackgroundObjectUrl = url;
        };

        if (!currentWebhook) {
            setBackground('');
            body.style.backgroundColor = '';
            return;
        }

        // If avatar stored in IDB, prefer avatarBgKey for higher-quality background; fallback to avatarKey
        const bgKey = currentWebhook.avatarBgKey || currentWebhook.avatarKey;
        if (currentWebhook.avatarType === 'indexeddb' && bgKey) {
            idbGetBlob(bgKey).then(blob => {
                if (blob) {
                    const objUrl = URL.createObjectURL(blob);
                    setBackground(objUrl, true);
                    body.style.backgroundColor = '';
                } else {
                    const fallback = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                    setBackground(fallback, false);
                }
            }).catch(() => {
                const fallback = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                setBackground(fallback, false);
            });
            return;
        }

        // If avatar is a dataURL or URL, use it directly
        const src = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
        setBackground(src, false);
        body.style.backgroundColor = '';
    }

    function updateButtonStates() {
        const hasCategory = !!currentCategory;
        const hasWebhook = !!currentWebhook;
        
        document.getElementById('editCategoryBtn').disabled = !hasCategory;
        document.getElementById('deleteCategoryBtn').disabled = !hasCategory;
        addWebhookBtn.disabled = !hasCategory;
        document.getElementById('editWebhookBtn').disabled = !hasWebhook;
        document.getElementById('deleteWebhookBtn').disabled = !hasWebhook;
        uploadButton.disabled = !hasWebhook;
    }

    function updateCurrentSelections() {
        currentCategoryDisplay.textContent = currentCategory ? currentCategory.name : 'None selected';
        currentWebhookDisplay.textContent = currentWebhook ? currentWebhook.name : 'None selected';
    }

    function updateCategorySelector() {
        categorySelector.innerHTML = '<option value="">Select a category</option>';
        
        categories.sort((a, b) => a.name.localeCompare(b.name)).forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            categorySelector.appendChild(option);
        });
    }

    function updateWebhookSelector(categoryId) {
        webhookSelector.innerHTML = '<option value="">Select a webhook</option>';
        webhookSelector.disabled = !categoryId;
        
        if (categoryId) {
            const category = categories.find(c => c.id === categoryId);
            if (category) {
                category.webhooks.sort((a, b) => a.name.localeCompare(b.name)).forEach(webhook => {
                    const option = document.createElement('option');
                    option.value = webhook.id;
                    option.textContent = webhook.name;
                    webhookSelector.appendChild(option);
                });
            }
        }
    }

    function updateButtonTexts() {
        addCategoryBtn.textContent = currentCategory ? 'Settings' : 'Add Category';
        addCategoryBtn.classList.toggle('settings', !!currentCategory);
        
        addWebhookBtn.textContent = currentWebhook ? 'Settings' : 'Add Webhook';
        addWebhookBtn.classList.toggle('settings', !!currentWebhook);
    }

    function updateWebhookAvatar() {
        const webhookAvatarLeft = document.getElementById('webhookAvatarLeft');
        const webhookAvatarRight = document.getElementById('webhookAvatarRight');
        const webhookAvatarPreview = document.getElementById('webhookAvatarPreview');
        const webhookAvatarPreview2 = document.getElementById('webhookAvatarPreview2');
    const webhookAvatarMain = document.getElementById('webhookAvatarMain');
        
        // If a webhook is selected and it has its own avatar saved, prefer that for the webhook preview
        if (currentWebhook) {
            // Helper to set src and revoke later
            const setBlobUrl = (blob, el) => {
                if (!blob || !el) return;
                const objUrl = URL.createObjectURL(blob);
                el.src = objUrl;
                setTimeout(() => URL.revokeObjectURL(objUrl), 60 * 1000);
            };

            // Prefer avatarBgKey for background usage but still use avatarKey for previews
            if (currentWebhook.avatarType === 'indexeddb' && (currentWebhook.avatarKey || currentWebhook.avatarBgKey)) {
                // load preview blob from avatarKey (if present) for previews, but prefer bgKey when available for main preview
                const previewKey = currentWebhook.avatarKey || currentWebhook.avatarBgKey;
                idbGetBlob(previewKey).then(blob => {
                    if (blob) {
                        if (webhookAvatarPreview) setBlobUrl(blob, webhookAvatarPreview);
                        if (webhookAvatarPreview2) setBlobUrl(blob, webhookAvatarPreview2);
                        if (webhookAvatarMain) setBlobUrl(blob, webhookAvatarMain);
                    }
                }).catch(err => {
                    console.warn('Failed to load avatar blob from IDB', err);
                    const fallback = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                    if (webhookAvatarPreview) webhookAvatarPreview.src = fallback;
                    if (webhookAvatarPreview2) webhookAvatarPreview2.src = fallback;
                    if (webhookAvatarMain) webhookAvatarMain.src = fallback;
                });
            } else {
                const src = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                if (webhookAvatarPreview) webhookAvatarPreview.src = src;
                if (webhookAvatarPreview2) webhookAvatarPreview2.src = src;
                if (webhookAvatarMain) webhookAvatarMain.src = src;
            }
        } else {
            // no webhook selected: reset main preview to default
            if (webhookAvatarMain) webhookAvatarMain.src = 'images/default-avatar.png';
        }

        // Left/Right avatars: prefer per-webhook avatars if present, otherwise fallback to global
        const setBlobUrl = (blob, el) => {
            if (!blob || !el) return;
            const objUrl = URL.createObjectURL(blob);
            el.src = objUrl;
            setTimeout(() => URL.revokeObjectURL(objUrl), 60 * 1000);
        };

        // LEFT
        if (currentWebhook && (currentWebhook.leftAvatarType || currentWebhook.leftAvatarKey)) {
            if (currentWebhook.leftAvatarType === 'indexeddb' && currentWebhook.leftAvatarKey) {
                idbGetBlob(currentWebhook.leftAvatarKey).then(blob => {
                    if (blob && webhookAvatarLeft) setBlobUrl(blob, webhookAvatarLeft);
                }).catch(() => {
                    const fallback = currentWebhook.leftAvatar || getAvatarUrl(currentWebhook.leftAvatarType);
                    if (webhookAvatarLeft) webhookAvatarLeft.src = fallback;
                });
            } else {
                const src = currentWebhook.leftAvatar || getAvatarUrl(currentWebhook.leftAvatarType);
                if (webhookAvatarLeft) webhookAvatarLeft.src = src;
            }
        } else {
            if (webhookAvatarLeft) {
                webhookAvatarLeft.src = leftAvatar === 'custom' && leftCustomAvatar ? leftCustomAvatar : getAvatarUrl(leftAvatar);
            }
        }

        // RIGHT
        if (currentWebhook && (currentWebhook.rightAvatarType || currentWebhook.rightAvatarKey)) {
            if (currentWebhook.rightAvatarType === 'indexeddb' && currentWebhook.rightAvatarKey) {
                idbGetBlob(currentWebhook.rightAvatarKey).then(blob => {
                    if (blob && webhookAvatarRight) setBlobUrl(blob, webhookAvatarRight);
                }).catch(() => {
                    const fallback = currentWebhook.rightAvatar || getAvatarUrl(currentWebhook.rightAvatarType);
                    if (webhookAvatarRight) webhookAvatarRight.src = fallback;
                });
            } else {
                const src = currentWebhook.rightAvatar || getAvatarUrl(currentWebhook.rightAvatarType);
                if (webhookAvatarRight) webhookAvatarRight.src = src;
            }
        } else {
            if (webhookAvatarRight) {
                webhookAvatarRight.src = rightAvatar === 'custom' && rightCustomAvatar ? rightCustomAvatar : getAvatarUrl(rightAvatar);
            }
        }
    }

    function getAvatarUrl(avatarType) {
        const avatarMap = {
            'default': 'images/default-avatar.png',
            'default2': 'images/default-avatar1.png',
            'default3': 'images/default-avatar2.png'
        };
        
        return avatarMap[avatarType] || 'images/default-avatar.png';
    }

    // Funciones para manejar selecciones
    function setCurrentCategory(category) {
        currentCategory = category;
        currentWebhook = null;
        updateUI();
    }

    function setCurrentWebhook(webhook) {
        currentWebhook = webhook;
        updateUI();
    }

    // Funciones para CRUD
function addCategory() {
    const name = categoryNameInput.value.trim();
    
    if (!name) {
        showNotification('Please enter a category name', true);
        return;
    }
    
    const newCategory = {
        id: generateId(),
        name: name,
        webhooks: [], // ← Asegúrate de que esto sea un array
        createdAt: new Date().toISOString()
    };
    
    categories.push(newCategory);
    console.log('Category added:', newCategory); // Debug
    console.log('All categories:', categories); // Debug
    
    showForm(categoryForm, false);
    setCurrentCategory(newCategory);
    categoryNameInput.value = '';
    showNotification('Category added successfully!');
}

    function editCategory() {
        const name = categoryNameInput.value.trim();
        
        if (!name) {
            showNotification('Please enter a category name', true);
            return;
        }
        
        if (!currentCategory) return;
        
        const categoryIndex = categories.findIndex(c => c.id === currentCategory.id);
        if (categoryIndex !== -1) {
            categories[categoryIndex].name = name;
            currentCategory.name = name;
            showForm(categoryForm, false);
            categoryNameInput.value = '';
            updateUI();
            showNotification('Category updated successfully!');
        }
    }

    function deleteCategory() {
        if (!currentCategory) return;
        
        if (confirm(`Are you sure you want to delete the category "${currentCategory.name}" and all its webhooks?`)) {
            categories = categories.filter(c => c.id !== currentCategory.id);
            setCurrentCategory(null);
            showNotification('Category deleted successfully!');
        }
    }

    function addWebhook() {
        const name = webhookNameInput.value.trim();
        const url = webhookUrlInput.value.trim();
        
        if (!name || !url) {
            showNotification('Please enter both name and URL', true);
            return;
        }
        
        if (!url.startsWith('https://discord.com/api/webhooks/')) {
            showNotification('Please enter a valid Discord webhook URL', true);
            return;
        }
        
        const newWebhook = {
            id: generateId(),
            name: name,
            url: url,
            avatar: 'images/default-avatar.png',
            avatarType: 'default',
            // background defaults
            bgEnabled: false,
            bgOpacity: 0.35,
            bgBlur: 6,
            bgPosH: 50,
            bgPosV: 50,
            bgRotate: 0,
            createdAt: new Date().toISOString()
        };
        
        saveWebhookToCategory(newWebhook);
    }

    function saveWebhookToCategory(webhook) {
        const categoryIndex = categories.findIndex(c => c.id === currentCategory.id);
        if (categoryIndex !== -1) {
            categories[categoryIndex].webhooks.push(webhook);
            showForm(webhookForm, false);
            webhookNameInput.value = '';
            webhookUrlInput.value = '';
            setCurrentWebhook(webhook);
            showNotification('Webhook added successfully!');
        }
    }

    function editWebhook() {
        const name = webhookNameInput.value.trim();
        const url = webhookUrlInput.value.trim();
        
        if (!name || !url) {
            showNotification('Please enter both name and URL', true);
            return;
        }
        
        if (!url.startsWith('https://discord.com/api/webhooks/')) {
            showNotification('Please enter a valid Discord webhook URL', true);
            return;
        }
        
        if (!currentCategory || !currentWebhook) return;
        
        const categoryIndex = categories.findIndex(c => c.id === currentCategory.id);
        if (categoryIndex !== -1) {
            const webhookIndex = categories[categoryIndex].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (webhookIndex !== -1) {
                categories[categoryIndex].webhooks[webhookIndex].name = name;
                categories[categoryIndex].webhooks[webhookIndex].url = url;
                
                currentWebhook.name = name;
                currentWebhook.url = url;
                
                showForm(webhookForm, false);
                updateUI();
                showNotification('Webhook updated successfully!');
            }
        }
    }

    function deleteWebhook() {
        if (!currentCategory || !currentWebhook) return;
        
        if (confirm(`Are you sure you want to delete the webhook "${currentWebhook.name}"?`)) {
            const categoryIndex = categories.findIndex(c => c.id === currentCategory.id);
            if (categoryIndex !== -1) {
                // find webhook to delete so we can cleanup IDB keys
                const wh = categories[categoryIndex].webhooks.find(w => w.id === currentWebhook.id);
                if (wh) {
                    // delete avatar blobs if present (including background copies)
                    const keys = [];
                    if (wh.avatarKey) keys.push(wh.avatarKey);
                    if (wh.avatarBgKey) keys.push(wh.avatarBgKey);
                    if (wh.leftAvatarKey) keys.push(wh.leftAvatarKey);
                    if (wh.rightAvatarKey) keys.push(wh.rightAvatarKey);
                    // attempt deletion (don't block on failures)
                    keys.forEach(k => { try { idbDelete(k); } catch (e) { /* ignore */ } });
                }

                categories[categoryIndex].webhooks = categories[categoryIndex].webhooks.filter(w => w.id !== currentWebhook.id);
                setCurrentWebhook(null);
                showNotification('Webhook deleted successfully!');
            }
        }
    }

    // Función para crear elementos de previsualización
    function createPreviewElement(file, url) {
        const previewElement = document.createElement('div');
        previewElement.className = 'preview-item';
        
        let mediaContent = file.type.startsWith('image/') 
            ? `<img src="${url}" alt="${file.name}" class="uploaded-media">`
            : file.type.startsWith('video/') 
                ? `<video controls class="uploaded-media"><source src="${url}" type="${file.type}"></video>`
                : `<div class="file-icon">📄</div>`;
        
        previewElement.innerHTML = `
            <a href="${url}" target="_blank">${mediaContent}</a>
            <p class="file-name">${file.name}</p>
            <p class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
            <input type="text" value="${url}" readonly class="url-input">
            <button class="copy-btn" data-url="${url}">Copy URL</button>
        `;
        
        // Agregar evento para el botón de copiar
        previewElement.querySelector('.copy-btn').addEventListener('click', function() {
            const url = this.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                this.textContent = 'Copied!';
                setTimeout(() => this.textContent = 'Copy URL', 2000);
            });
        });
        
        return previewElement;
    }

    // Funciones para exportar/importar configuración (MANTENIDAS)
function exportConfiguration() {
    // Preparar datos para exportar
    const data = {
        categories: categories,
        lastUsedCategory: currentCategory?.id,
        lastUsedWebhook: currentWebhook?.id,
        avatarPreferences: {
            leftAvatar: leftAvatar,
            rightAvatar: rightAvatar,
            leftCustomAvatar: leftCustomAvatar,
            rightCustomAvatar: rightCustomAvatar
        },
        savedAt: new Date().toISOString()
    };
    
    console.log('Exporting data:', data); // Para debugging
    
    // Crear el blob con los datos
    const blob = new Blob([JSON.stringify(data, null, 2)], { 
        type: 'application/json' 
    });
    
    // Crear URL para descargar
    const url = URL.createObjectURL(blob);
    
    // Crear elemento de descarga
    const a = document.createElement('a');
    a.href = url;
    a.download = CONFIG_FILE_NAME;
    document.body.appendChild(a);
    
    // Disparar la descarga
    a.click();
    
    // Limpiar
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
    
    showNotification('Configuration exported successfully!');
}

function importConfiguration(file) {
    const reader = new FileReader();
    
    reader.onload = async function(e) {
        try {
            const data = JSON.parse(e.target.result);
            console.log('Imported data:', data); // Para debugging
            
            if (data.categories && Array.isArray(data.categories)) {
                categories = data.categories;

                // Normalize webhooks: ensure each webhook has avatar and avatarType fields
                // We'll also migrate any embedded avatars into IndexedDB to keep runtime representation small.
                const migratePromises = [];
                categories.forEach(cat => {
                    if (!Array.isArray(cat.webhooks)) cat.webhooks = [];
                    cat.webhooks.forEach(wh => {
                        // If an embedded avatar was exported, it's likely a dataURL string. Convert to blob and store in IDB.
                        if (wh.avatarType === 'embedded' && wh.avatar && typeof wh.avatar === 'string' && wh.avatar.startsWith('data:')) {
                            const p = (async () => {
                                // convert dataURL to Blob
                                const res = await fetch(wh.avatar);
                                const blob = await res.blob();
                                const key = `avatar-${wh.id}`;
                                try {
                                    await idbPutBlob(key, blob);
                                    // replace runtime fields to use IDB
                                    wh.avatarKey = key;
                                    wh.avatarType = 'indexeddb';
                                    wh.avatar = null;
                                } catch (err) {
                                    console.warn('Failed to migrate embedded avatar to IDB', err);
                                }
                            })();
                            migratePromises.push(p);
                        
                            // Migrate embedded left/right avatars if present
                            if (wh.leftAvatarType === 'embedded' && wh.leftAvatar && typeof wh.leftAvatar === 'string' && wh.leftAvatar.startsWith('data:')) {
                                const pl = (async () => {
                                    try {
                                        const res = await fetch(wh.leftAvatar);
                                        const blob = await res.blob();
                                        const key = `avatar-left-${wh.id}`;
                                        await idbPutBlob(key, blob);
                                        wh.leftAvatarKey = key;
                                        wh.leftAvatarType = 'indexeddb';
                                        wh.leftAvatar = null;
                                    } catch (err) {
                                        console.warn('Failed to migrate embedded left avatar to IDB', err);
                                    }
                                })();
                                migratePromises.push(pl);
                            }

                            if (wh.rightAvatarType === 'embedded' && wh.rightAvatar && typeof wh.rightAvatar === 'string' && wh.rightAvatar.startsWith('data:')) {
                                const pr = (async () => {
                                    try {
                                        const res = await fetch(wh.rightAvatar);
                                        const blob = await res.blob();
                                        const key = `avatar-right-${wh.id}`;
                                        await idbPutBlob(key, blob);
                                        wh.rightAvatarKey = key;
                                        wh.rightAvatarType = 'indexeddb';
                                        wh.rightAvatar = null;
                                    } catch (err) {
                                        console.warn('Failed to migrate embedded right avatar to IDB', err);
                                    }
                                })();
                                migratePromises.push(pr);
                            }
                        
                        // If a background copy was exported separately as embedded, migrate it into IDB too
                        if (!wh.avatarBgKey && wh.avatarBgType === 'embedded' && wh.avatarBg && typeof wh.avatarBg === 'string' && wh.avatarBg.startsWith('data:')) {
                            const pbg = (async () => {
                                try {
                                    // Fetch the embedded dataURL and store the resulting blob directly to avoid recompression
                                    const res = await fetch(wh.avatarBg);
                                    const blob = await res.blob();
                                    const key = `avatar-bg-${wh.id}`;
                                    await idbPutBlob(key, blob);
                                    wh.avatarBgKey = key;
                                    wh.avatarBgType = 'indexeddb';
                                    wh.avatarBg = null;
                                } catch (err) {
                                    console.warn('Failed to migrate embedded avatarBg to IDB', err);
                                }
                            })();
                            migratePromises.push(pbg);
                        }
                        } else {
                            // reconstruct avatar URL from avatarType if possible and ensure defaults
                            if (!wh.avatar && wh.avatarType) {
                                if (wh.avatarType === 'custom' && wh.avatar) {
                                    // already has avatar as dataURL
                                } else if (wh.avatarType && ['default','default2','default3'].includes(wh.avatarType)) {
                                    const map = {
                                        'default': 'images/default-avatar.png',
                                        'default2': 'images/default-avatar1.png',
                                        'default3': 'images/default-avatar2.png'
                                    };
                                    wh.avatar = map[wh.avatarType] || 'images/default-avatar.png';
                                }
                            }
                            if (!wh.avatar) wh.avatar = 'images/default-avatar.png';
                            if (!wh.avatarType) wh.avatarType = 'default';
                        }
                        // (previously normalized mini-preview properties here; reverted)
                    });
                });

                // wait for migrations to complete before continuing
                try { await Promise.all(migratePromises); } catch (err) { /* ignore migration failures */ }
                
                // Cargar preferencias de avatar si existen
                if (data.avatarPreferences) {
                    leftAvatar = data.avatarPreferences.leftAvatar || 'default';
                    rightAvatar = data.avatarPreferences.rightAvatar || 'default';
                    leftCustomAvatar = data.avatarPreferences.leftCustomAvatar || null;
                    rightCustomAvatar = data.avatarPreferences.rightCustomAvatar || null;
                }
                
                // Ask the user whether they want to restore the previous selections using the friendly modal.
                (async function() {
                    let restored = false;
                    if (data.lastUsedCategory) {
                        const cat = categories.find(c => c.id === data.lastUsedCategory);
                        if (cat) {
                            const wh = data.lastUsedWebhook ? cat.webhooks.find(w => w.id === data.lastUsedWebhook) : null;
                            const wantRestore = await showRestoreModal(cat.name, wh ? wh.name : null);
                            if (wantRestore) {
                                setCurrentCategory(cat);
                                if (wh) setCurrentWebhook(wh);
                                restored = true;
                            }
                        }
                    }

                    if (!restored) {
                        setCurrentCategory(null);
                        setCurrentWebhook(null);
                    }

                    updateUI();
                    updateWebhookAvatar();
                })();
                showNotification('Configuration imported successfully!');
            } else {
                throw new Error('Invalid configuration format');
            }
        } catch (error) {
            console.error('Error loading config file:', error);
            showNotification('Error: Invalid configuration file.', true);
        }
    };
    
    reader.readAsText(file);
}

    // Upload files to Discord (simplificado)
    uploadButton.addEventListener('click', async function() {
        if (!currentWebhook) {
            showNotification('Please select a webhook first', true);
            return;
        }

        if (!selectedFiles || selectedFiles.length === 0) {
            showNotification('Please select at least one file.', true);
            return;
        }

        responseDiv.textContent = 'Uploading files...';
        responseDiv.style.color = '';
        previewContainer.innerHTML = '';

        try {
            // Batch files by both count and cumulative size so each message:
            // - contains at most 10 files (Discord limit per message)
            // - has total bytes <= MAX_BATCH_BYTES (user expects ~10 MB)
            const filesToUpload = selectedFiles.slice();
            const MAX_FILES_PER_BATCH = 10;
            const MAX_BATCH_BYTES = 10 * 1024 * 1024; // 10 MB

            const batches = [];
            let currentBatch = [];
            let currentBytes = 0;

            for (let i = 0; i < filesToUpload.length; i++) {
                const f = filesToUpload[i];
                const fsize = typeof f.size === 'number' ? f.size : 0;

                // If single file exceeds limit, put it alone in a batch (will likely fail server-side)
                if (fsize > MAX_BATCH_BYTES) {
                    if (currentBatch.length > 0) {
                        batches.push(currentBatch);
                        currentBatch = [];
                        currentBytes = 0;
                    }
                    batches.push([f]);
                    continue;
                }

                // If adding this file would exceed file count or size, close current batch
                if (currentBatch.length + 1 > MAX_FILES_PER_BATCH || (currentBytes + fsize) > MAX_BATCH_BYTES) {
                    if (currentBatch.length > 0) {
                        batches.push(currentBatch);
                    }
                    currentBatch = [f];
                    currentBytes = fsize;
                } else {
                    currentBatch.push(f);
                    currentBytes += fsize;
                }
            }

            if (currentBatch.length > 0) batches.push(currentBatch);

            let totalSent = 0;
            // show total batches to user
            if (batches.length > 1) {
                responseDiv.textContent = `Uploading ${filesToUpload.length} files in ${batches.length} batches...`;
            } else {
                responseDiv.textContent = `Uploading ${filesToUpload.length} files...`;
            }

            for (let b = 0; b < batches.length; b++) {
                // per-batch progress
                responseDiv.textContent = `Uploading batch ${b + 1} of ${batches.length} (${batches[b].length} files)...`;
                const chunk = batches[b];
                const fd = new FormData();
                for (let j = 0; j < chunk.length; j++) {
                    fd.append(`files[${j}]`, chunk[j], chunk[j].name);
                }

                try {
                    const resp = await fetch(currentWebhook.url, { method: 'POST', body: fd });
                    if (!resp.ok) {
                        console.error('Batch upload failed', resp.status, await resp.text().catch(() => ''));
                        continue; // try next batch
                    }

                    let result = null;
                    try { result = await resp.json(); } catch (e) { result = null; }

                    if (result && result.attachments && result.attachments.length > 0) {
                        result.attachments.forEach((attachment, aidx) => {
                            const file = chunk[aidx] || null;
                            const previewElement = createPreviewElement(file || { name: attachment.filename || 'file' }, attachment.url);
                            previewContainer.appendChild(previewElement);
                            try { panelFiles.push({ id: attachment.id || (attachment.url + '-' + Date.now()), file: file, url: attachment.url }); } catch (e) { /* ignore */ }
                            totalSent++;
                        });
                    } else if (result && result.url) {
                        const previewElement = createPreviewElement(chunk[0], result.url);
                        previewContainer.appendChild(previewElement);
                        try { panelFiles.push({ id: result.id || (result.url + '-' + Date.now()), file: chunk[0], url: result.url }); } catch (e) { /* ignore */ }
                        totalSent++;
                    } else {
                        console.warn('Batch upload returned no attachments', result);
                    }
                } catch (err) {
                    console.error('Error uploading batch', err);
                }

                // small delay between batches
                await new Promise(r => setTimeout(r, 350));
            }

            // Clear selection after attempting upload
            selectedFiles = [];
            fileInput.value = '';
            const dtClear = new DataTransfer();
            fileInput.files = dtClear.files;

            if (totalSent > 0) showNotification(`Successfully uploaded ${totalSent} files!`);
            else showNotification('Upload completed but no file URLs returned.', true);
        } catch (error) {
            console.error('Error uploading files:', error);
            showNotification('Error uploading files. Check console for details.', true);
        }
    });

    // Event Listeners básicos
    // Nueva lógica: mantener lista de archivos seleccionados y permitir quitar individuales
    fileInput.addEventListener('change', function() {
        selectedFiles = this.files ? Array.from(this.files) : [];
        renderSelectedPreviews();
    });

    // Renderizar previsualizaciones de archivos seleccionados con botón para eliminar
    function renderSelectedPreviews() {
        previewContainer.innerHTML = '';
        if (!selectedFiles || selectedFiles.length === 0) return;

        // Create placeholders in the correct order so async FileReader completions
        // can't reorder the displayed items.
        const placeholders = [];
        for (let i = 0; i < selectedFiles.length; i++) {
            const placeholder = document.createElement('div');
            placeholder.className = 'preview-item';
            placeholder.setAttribute('data-index', i);
            // lightweight placeholder content while the file is read
            placeholder.innerHTML = `<div class="preview-loading">Loading...</div>`;
            previewContainer.appendChild(placeholder);
            placeholders.push(placeholder);
        }

        // Fill placeholders as reads complete
        selectedFiles.forEach((file, index) => {
            const reader = new FileReader();
            reader.onload = function(e) {
                const previewElement = placeholders[index];
                if (!previewElement) return;
                let mediaContent = '';
                if (file.type && file.type.startsWith('image/')) {
                    mediaContent = `<img src="${e.target.result}" alt="${file.name}" class="preview-media">`;
                } else if (file.type && file.type.startsWith('video/')) {
                    mediaContent = `<video controls class="preview-media"><source src="${e.target.result}" type="${file.type}"></video>`;
                } else {
                    mediaContent = `<div class="file-icon">📄</div>`;
                }

                previewElement.innerHTML = `
                    ${mediaContent}
                    <p class="file-name" title="${file.name}">${file.name}</p>
                    <p class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    <div class="preview-actions">
                        <button class="remove-btn">Remove</button>
                    </div>
                `;

                // Attach remove handler that reads the element's current data-index
                const removeBtn = previewElement.querySelector('.remove-btn');
                if (removeBtn) {
                    removeBtn.addEventListener('click', function() {
                        const parent = this.closest('.preview-item');
                        if (!parent) return;
                        const idxStr = parent.getAttribute('data-index');
                        const idx = parseInt(idxStr, 10);
                        if (isNaN(idx)) return;

                        // Remove the file from the selectedFiles array and rebuild inputs
                        selectedFiles.splice(idx, 1);
                        const dt = new DataTransfer();
                        selectedFiles.forEach(f => dt.items.add(f));
                        fileInput.files = dt.files;

                        // Re-render previews to refresh indices and placeholders
                        renderSelectedPreviews();
                    });
                }
            };
            reader.readAsDataURL(file);
        });
    }

    // Always open the add-category form when clicking the Add button; use edit via the Edit button
    addCategoryBtn.addEventListener('click', () => {
        showForm(categoryForm, true);
        saveCategoryBtn.onclick = addCategory;
        categoryNameInput.value = '';
        categoryNameInput.focus();
    });

    document.getElementById('editCategoryBtn').addEventListener('click', () => {
        if (!currentCategory) return;
        showForm(categoryForm, true);
        saveCategoryBtn.onclick = editCategory;
        categoryNameInput.value = currentCategory.name;
        categoryNameInput.focus();
    });

    document.getElementById('deleteCategoryBtn').addEventListener('click', deleteCategory);

    cancelCategoryBtn.addEventListener('click', () => {
        showForm(categoryForm, false);
    });

    // Always open the add-webhook form when clicking the Add button; use edit via the Edit button
    addWebhookBtn.addEventListener('click', () => {
        if (!currentCategory) return;
        showForm(webhookForm, true);
        saveWebhookBtn.onclick = addWebhook;
        webhookNameInput.value = '';
        webhookUrlInput.value = '';
        webhookNameInput.focus();
    });

    document.getElementById('editWebhookBtn').addEventListener('click', () => {
        if (!currentWebhook) return;
        showForm(webhookForm, true);
        saveWebhookBtn.onclick = editWebhook;
        webhookNameInput.value = currentWebhook.name;
        webhookUrlInput.value = currentWebhook.url;
        webhookNameInput.focus();
    });

    document.getElementById('deleteWebhookBtn').addEventListener('click', deleteWebhook);

    cancelWebhookBtn.addEventListener('click', () => {
        showForm(webhookForm, false);
    });

    categorySelector.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            setCurrentCategory(null);
            return;
        }
        
        const selectedCategory = categories.find(c => c.id === selectedId);
        setCurrentCategory(selectedCategory);
    });

    webhookSelector.addEventListener('change', (e) => {
        const selectedId = e.target.value;
        if (!selectedId || !currentCategory) {
            setCurrentWebhook(null);
            return;
        }
        
        const selectedWebhook = currentCategory.webhooks.find(w => w.id === selectedId);
        setCurrentWebhook(selectedWebhook);
    });

    // Import/Export
    exportBtn.addEventListener('click', exportConfiguration);
    importBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) importConfiguration(e.target.files[0]);
    });

    // Inicialización
    function initApp() {
        updateUI();
        updateButtonTexts();
        updateWebhookAvatar();
    }

    initApp();

    // Background controls wiring
    const bgEnableToggle = document.getElementById('bgEnableToggle');
    const bgOpacityRange = document.getElementById('bgOpacityRange');
    const bgBlurRange = document.getElementById('bgBlurRange');
    const bgPosHRange = document.getElementById('bgPosHRange');
    const bgPosVRange = document.getElementById('bgPosVRange');
    const bgRotateRange = document.getElementById('bgRotateRange');
    const backgroundLayer = document.getElementById('backgroundLayer');

    function applyBackgroundLayerStyles(enabled, opacity, blur) {
        if (!backgroundLayer) return;
        if (!enabled) {
            backgroundLayer.style.opacity = '0';
            backgroundLayer.style.filter = '';
            return;
        }
        backgroundLayer.style.opacity = (opacity != null ? opacity : 0.35).toString();
        backgroundLayer.style.filter = `blur(${blur != null ? blur : 6}px)`;
    // apply position and rotation if provided on currentWebhook
    const h = (currentWebhook && currentWebhook.bgPosH != null) ? currentWebhook.bgPosH : 50;
    const v = (currentWebhook && currentWebhook.bgPosV != null) ? currentWebhook.bgPosV : 50;
    const rot = (currentWebhook && currentWebhook.bgRotate != null) ? currentWebhook.bgRotate : 0;
    backgroundLayer.style.backgroundPosition = `${h}% ${v}%`;
    backgroundLayer.style.transform = `rotate(${rot}deg)`;
    // Note: do not copy slider-driven styles into the mini-preview here.
    // Mini-preview has its own sliders (`mini*Range`) and is controlled separately.
    // Only the background image source (set elsewhere) will be copied into the mini preview.
    }

    // When webhook changes update controls to match its settings
    const syncBgControlsWithWebhook = () => {
        if (!bgEnableToggle || !bgOpacityRange || !bgBlurRange) return;
        if (!currentWebhook) {
            bgEnableToggle.checked = false;
            bgOpacityRange.value = 0.35;
            bgBlurRange.value = 6;
            applyBackgroundLayerStyles(false);
            return;
        }

    const enabled = currentWebhook.bgEnabled != null ? !!currentWebhook.bgEnabled : false;
    const opacity = currentWebhook.bgOpacity != null ? currentWebhook.bgOpacity : 0.35;
    const blur = currentWebhook.bgBlur != null ? currentWebhook.bgBlur : 6;
    const posH = currentWebhook.bgPosH != null ? currentWebhook.bgPosH : 50;
    const posV = currentWebhook.bgPosV != null ? currentWebhook.bgPosV : 50;
    const rot = currentWebhook.bgRotate != null ? currentWebhook.bgRotate : 0;

    bgEnableToggle.checked = enabled;
    bgOpacityRange.value = opacity;
    bgBlurRange.value = blur;
    if (bgPosHRange) bgPosHRange.value = posH;
    if (bgPosVRange) bgPosVRange.value = posV;
    if (bgRotateRange) bgRotateRange.value = rot;
    applyBackgroundLayerStyles(enabled, opacity, blur);
    };

    // (mini-preview sync function removed — mini-preview UI remains runtime-only)

    // Helper to set visual fill on range inputs using CSS variable
    function setRangeFill(el) {
        if (!el) return;
        const min = parseFloat(el.min) || 0;
        const max = parseFloat(el.max) || 1;
        const val = parseFloat(el.value);
        const ratio = (val - min) / (max - min || 1);
        el.setAttribute('data-fill', 'true');
        el.style.setProperty('--range-fill', '' + ratio);
    }

    // Initialize visual fills and wire input listeners
    [bgOpacityRange, bgBlurRange, bgPosHRange, bgPosVRange, bgRotateRange].forEach(r => {
        if (!r) return;
        setRangeFill(r);
        r.addEventListener('input', () => setRangeFill(r));
    });

    // updateAppBackground uses currentWebhook.avatar; ensure backgroundLayer gets the image too
    const bgMiniPreview = document.getElementById('bgMiniPreview');
    const setBackgroundImageToLayer = (url, isObjectUrl) => {
        if (!backgroundLayer) return;
        try {
            if (_lastBackgroundObjectUrl && _lastBackgroundObjectUrl !== url) {
                try { URL.revokeObjectURL(_lastBackgroundObjectUrl); } catch (e) { /* ignore */ }
                _lastBackgroundObjectUrl = null;
            }
        } catch (e) { /* ignore */ }

        if (!url) {
            backgroundLayer.style.backgroundImage = '';
            return;
        }

        backgroundLayer.style.backgroundImage = `url("${url}")`;
        if (isObjectUrl) _lastBackgroundObjectUrl = url;
        // sync mini-preview if present
        try {
            if (bgMiniPreview) {
                bgMiniPreview.style.backgroundImage = `url("${url}")`;
                // copy position and transform from backgroundLayer
                bgMiniPreview.style.backgroundPosition = backgroundLayer.style.backgroundPosition || '50% 50%';
                bgMiniPreview.style.transform = backgroundLayer.style.transform || 'rotate(0deg)';
            }
        } catch (e) { /* ignore */ }
    };

    // decorate updateAppBackground to also update backgroundLayer image and respect per-webhook settings
    const _origUpdateAppBackground = updateAppBackground;
    updateAppBackground = function() {
        // call original which sets body background (kept for compatibility)
        _origUpdateAppBackground();

        // set layer image and styles according to currentWebhook settings
        if (!currentWebhook) {
            setBackgroundImageToLayer(null);
            applyBackgroundLayerStyles(false);
            return;
        }

        // read per-webhook settings
        const enabled = currentWebhook.bgEnabled != null ? !!currentWebhook.bgEnabled : false;
        const opacity = currentWebhook.bgOpacity != null ? currentWebhook.bgOpacity : 0.35;
        const blur = currentWebhook.bgBlur != null ? currentWebhook.bgBlur : 6;

        // set image source: prefer avatarBgKey for higher-quality background, fall back to avatarKey or avatar URL
        const layerBgKey = currentWebhook.avatarBgKey || currentWebhook.avatarKey;
        if (currentWebhook.avatarType === 'indexeddb' && layerBgKey) {
            idbGetBlob(layerBgKey).then(blob => {
                if (blob) {
                    const objUrl = URL.createObjectURL(blob);
                    setBackgroundImageToLayer(objUrl, true);
                    applyBackgroundLayerStyles(enabled, opacity, blur);
                } else {
                    const fallback = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                    setBackgroundImageToLayer(fallback);
                    applyBackgroundLayerStyles(enabled, opacity, blur);
                }
            }).catch(() => {
                const fallback = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
                setBackgroundImageToLayer(fallback);
                applyBackgroundLayerStyles(enabled, opacity, blur);
            });
        } else {
            const src = currentWebhook.avatar || getAvatarUrl(currentWebhook.avatarType);
            setBackgroundImageToLayer(src);
            applyBackgroundLayerStyles(enabled, opacity, blur);
        }

        // sync UI controls
        syncBgControlsWithWebhook();
    };

    // UI event listeners
    if (bgEnableToggle) bgEnableToggle.addEventListener('change', () => {
        if (!currentWebhook) return;
        currentWebhook.bgEnabled = !!bgEnableToggle.checked;
        // persist into categories
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgEnabled = currentWebhook.bgEnabled;
        }
        updateAppBackground();
    });

    if (bgOpacityRange) bgOpacityRange.addEventListener('input', () => {
        const val = parseFloat(bgOpacityRange.value);
        if (!currentWebhook) return;
        currentWebhook.bgOpacity = val;
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgOpacity = currentWebhook.bgOpacity;
        }
        applyBackgroundLayerStyles(currentWebhook.bgEnabled, currentWebhook.bgOpacity, currentWebhook.bgBlur);
    });

    if (bgBlurRange) bgBlurRange.addEventListener('input', () => {
        const val = parseInt(bgBlurRange.value, 10);
        if (!currentWebhook) return;
        currentWebhook.bgBlur = val;
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgBlur = currentWebhook.bgBlur;
        }
        applyBackgroundLayerStyles(currentWebhook.bgEnabled, currentWebhook.bgOpacity, currentWebhook.bgBlur);
    });

    if (bgPosHRange) bgPosHRange.addEventListener('input', () => {
        const val = parseInt(bgPosHRange.value, 10);
        if (!currentWebhook) return;
        currentWebhook.bgPosH = val;
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgPosH = currentWebhook.bgPosH;
        }
        applyBackgroundLayerStyles(currentWebhook.bgEnabled, currentWebhook.bgOpacity, currentWebhook.bgBlur);
    });

    if (bgPosVRange) bgPosVRange.addEventListener('input', () => {
        const val = parseInt(bgPosVRange.value, 10);
        if (!currentWebhook) return;
        currentWebhook.bgPosV = val;
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgPosV = currentWebhook.bgPosV;
        }
        applyBackgroundLayerStyles(currentWebhook.bgEnabled, currentWebhook.bgOpacity, currentWebhook.bgBlur);
    });

    if (bgRotateRange) bgRotateRange.addEventListener('input', () => {
        const val = parseInt(bgRotateRange.value, 10);
        if (!currentWebhook) return;
        currentWebhook.bgRotate = val;
        const ci = categories.findIndex(c => c.id === currentCategory?.id);
        if (ci !== -1) {
            const wi = categories[ci].webhooks.findIndex(w => w.id === currentWebhook.id);
            if (wi !== -1) categories[ci].webhooks[wi].bgRotate = currentWebhook.bgRotate;
        }
        applyBackgroundLayerStyles(currentWebhook.bgEnabled, currentWebhook.bgOpacity, currentWebhook.bgBlur);
    });

    // Helper: convert image File to compressed dataURL (resize and JPEG compress)
    // NOTE: Animated GIFs must NOT be rasterized via canvas because that flattens them
    // into a single-frame raster image; for GIFs we return the original dataURL to
    // preserve animation in previews and when storing to IndexedDB.
    async function fileToDataURL(file, maxWidth = 256, quality = 0.8) {
        if (!file) throw new Error('No file provided');
        if (!file.type || !file.type.startsWith('image/')) throw new Error('Not an image file');

        // Check for animation first; if animated return original dataURL to preserve animation
        const animated = await fileIsAnimated(file);
        if (animated) {
            return new Promise((resolve, reject) => {
                const r = new FileReader();
                r.onload = () => resolve(r.result);
                r.onerror = (e) => reject(e);
                r.readAsDataURL(file);
            });
        }

        // Not animated: rasterize/resize to JPEG dataURL
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const scale = Math.min(1, maxWidth / img.width);
                    const w = Math.max(1, Math.round(img.width * scale));
                    const h = Math.max(1, Math.round(img.height * scale));
                    const canvas = document.createElement('canvas');
                    canvas.width = w;
                    canvas.height = h;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, w, h);
                    try {
                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    } catch (err) {
                        reject(err);
                    }
                };
                img.onerror = (err) => reject(err);
                img.src = reader.result;
            };
            reader.onerror = (err) => reject(err);
            reader.readAsDataURL(file);
        });
    }

    // Listen for avatar selections from the avatar modal script and persist per-webhook when appropriate
    window.addEventListener('avatarSelected', async function(e) {
        const d = e.detail || {};
        if (!d || !d.context) return;

        if (d.context === 'webhook') {
            if (!currentWebhook || !currentCategory) return;

            // If custom and a File is provided, compress/resize before saving to reduce export size
            try {
                if (d.avatarType === 'custom' && d.avatarFile) {
                    // Compress to a blob and store in IDB, set avatarKey in webhook metadata
                    const blob = await fileToCompressedBlob(d.avatarFile, 256, 0.75);
                    const key = `avatar-${currentWebhook.id}`;
                    await idbPutBlob(key, blob);
                    currentWebhook.avatar = null; // blob stored in IDB
                    currentWebhook.avatarKey = key;
                    currentWebhook.avatarType = 'indexeddb';
                    // create and store a higher-quality background blob (store the original file to preserve max quality)
                    try {
                        const bgBlob = d.avatarFile; // original File is a Blob
                        const bgKey = `avatar-bg-${currentWebhook.id}`;
                        await idbPutBlob(bgKey, bgBlob);
                        currentWebhook.avatarBgKey = bgKey;
                    } catch (bgErr) {
                        console.warn('Failed to create/store background blob', bgErr);
                    }
                } else if (d.avatarType === 'custom' && d.avatarUrl) {
                    // fallback if modal provided a dataURL string
                    currentWebhook.avatar = d.avatarUrl;
                    currentWebhook.avatarType = 'custom';
                    // Try to store a background blob from the provided dataURL (if fetchable)
                    try {
                        const res = await fetch(d.avatarUrl);
                        const blob2 = await res.blob();
                        const bgKey2 = `avatar-bg-${currentWebhook.id}`;
                        await idbPutBlob(bgKey2, blob2);
                        currentWebhook.avatarBgKey = bgKey2;
                    } catch (errBg) {
                        // ignore background store failure
                    }
                } else if (d.avatarType === 'url') {
                    currentWebhook.avatar = d.avatarUrl || getAvatarUrl(d.avatarType);
                    currentWebhook.avatarType = 'url';
                } else {
                    // default types
                    currentWebhook.avatarType = d.avatarType || 'default';
                    currentWebhook.avatar = getAvatarUrl(currentWebhook.avatarType || currentWebhook.avatarType);
                    // if there was an existing IDB blob for this webhook, remove it to free space
                    if (currentWebhook.avatarKey) {
                        try { await idbDelete(currentWebhook.avatarKey); } catch (err) { /* ignore */ }
                        delete currentWebhook.avatarKey;
                    }
                    if (currentWebhook.avatarBgKey) {
                        try { await idbDelete(currentWebhook.avatarBgKey); } catch (err) { /* ignore */ }
                        delete currentWebhook.avatarBgKey;
                    }
                }
            } catch (err) {
                console.warn('Error processing custom avatar file:', err);
                // fallback to provided avatarUrl or default
                currentWebhook.avatar = d.avatarUrl || getAvatarUrl(d.avatarType);
                currentWebhook.avatarType = d.avatarType || 'default';
            }

            // Update the stored webhook inside categories so export includes the avatar
            const catIndex = categories.findIndex(c => c.id === currentCategory.id);
            if (catIndex !== -1) {
                const whIndex = categories[catIndex].webhooks.findIndex(w => w.id === currentWebhook.id);
                if (whIndex !== -1) {
                    categories[catIndex].webhooks[whIndex].avatar = currentWebhook.avatar;
                    categories[catIndex].webhooks[whIndex].avatarType = currentWebhook.avatarType;
                }
            }

            updateWebhookAvatar();
            showNotification('Webhook avatar updated');
        } else if (d.context === 'left') {
            leftAvatar = d.avatarType || 'default';
            leftCustomAvatar = d.avatarType === 'custom' ? d.avatarUrl : null;
            updateWebhookAvatar();
        } else if (d.context === 'right') {
            rightAvatar = d.avatarType || 'default';
            rightCustomAvatar = d.avatarType === 'custom' ? d.avatarUrl : null;
            updateWebhookAvatar();
        }
    });

    // Export with images: for webhooks that store images in IDB, embed base64 dataURLs into the exported JSON
    async function exportConfigurationWithImages() {
        // Deep copy categories to avoid mutating runtime objects
        const copy = JSON.parse(JSON.stringify(categories));

        // Walk webhooks, if avatarType === 'indexeddb' and avatarKey exists, fetch blob and convert to dataURL
        const promises = [];
        copy.forEach(cat => {
            if (!Array.isArray(cat.webhooks)) return;
            cat.webhooks.forEach(wh => {
                if (wh.avatarType === 'indexeddb' && wh.avatarKey) {
                    const p = idbGetBlob(wh.avatarKey).then(blob => {
                        if (blob) {
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = function(e) {
                                    wh.avatar = e.target.result;
                                    // mark as embedded for clarity
                                    wh.avatarType = 'embedded';
                                    resolve();
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        }
                    }).catch(err => {
                        console.warn('Failed to read blob for export', err);
                    });
                    promises.push(p);
                }
                // Prefer to embed a high-quality background image when possible
                if (wh.avatarBgKey) {
                    const pb = idbGetBlob(wh.avatarBgKey).then(blob => {
                        if (blob) {
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = function(e) {
                                    wh.avatarBg = e.target.result;
                                    wh.avatarBgType = 'embedded';
                                    resolve();
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        }
                    }).catch(err => {
                        console.warn('Failed to read bg blob for export', err);
                    });
                    promises.push(pb);
                } else if (wh.avatar && typeof wh.avatar === 'string' && /^https?:\/\//i.test(wh.avatar)) {
                    // If there's a remote avatar URL (likely original), try fetching and storing it as avatar-bg for export
                    const pf = (async () => {
                        try {
                            const res = await fetch(wh.avatar);
                            if (!res.ok) return;
                            const blob = await res.blob();
                            // Persist original to IDB for future exports/imports
                            try {
                                const key = `avatar-bg-${wh.id}`;
                                await idbPutBlob(key, blob);
                                wh.avatarBgKey = key;
                            } catch (e) {
                                // ignore idb store errors
                            }
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = function(e) {
                                    wh.avatarBg = e.target.result;
                                    wh.avatarBgType = 'embedded';
                                    resolve();
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        } catch (err) {
                            console.warn('Failed to fetch remote avatar for export', err);
                        }
                    })();
                    promises.push(pf);
                } else if (wh.avatarType === 'indexeddb' && wh.avatarKey) {
                    // Fallback: embed the preview blob as avatarBg if no original background exists
                    const pfb = idbGetBlob(wh.avatarKey).then(blob => {
                        if (blob) {
                            return new Promise((resolve, reject) => {
                                const reader = new FileReader();
                                reader.onload = function(e) {
                                    // embed under avatarBg to indicate background data is included
                                    wh.avatarBg = e.target.result;
                                    wh.avatarBgType = 'embedded';
                                    resolve();
                                };
                                reader.onerror = reject;
                                reader.readAsDataURL(blob);
                            });
                        }
                    }).catch(err => {
                        console.warn('Failed to read avatarKey blob for export fallback', err);
                    });
                    promises.push(pfb);
                }
            });
        });

        await Promise.all(promises);

        const data = {
            categories: copy,
            lastUsedCategory: currentCategory?.id,
            lastUsedWebhook: currentWebhook?.id,
            avatarPreferences: {
                leftAvatar: leftAvatar,
                rightAvatar: rightAvatar,
                leftCustomAvatar: leftCustomAvatar,
                rightCustomAvatar: rightCustomAvatar
            },
            exportedWithImages: true,
            savedAt: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = CONFIG_FILE_NAME;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
        showNotification('Configuration exported with images embedded.');
    }

    // Hook up new export button if present
    const exportWithImagesBtn = document.getElementById('exportWithImagesBtn');
    if (exportWithImagesBtn) exportWithImagesBtn.addEventListener('click', exportConfigurationWithImages);
    
    // Friendly modal helper: shows the restore modal and resolves true/false depending on user's choice
    function showRestoreModal(categoryName, webhookName) {
        return new Promise(resolve => {
            const modal = document.getElementById('restoreModal');
            const title = document.getElementById('restoreModalTitle');
            const msg = document.getElementById('restoreModalMessage');
            const yesBtn = document.getElementById('restoreModalYes');
            const noBtn = document.getElementById('restoreModalNo');

            if (!modal || !yesBtn || !noBtn || !title || !msg) {
                resolve(false);
                return;
            }

            title.textContent = 'Restore imported selections?';
            if (webhookName) {
                msg.textContent = `The imported config contains category "${categoryName}" and webhook "${webhookName}". Restore these selections now?`;
            } else {
                msg.textContent = `The imported config contains category "${categoryName}". Restore this selection now?`;
            }

            // Move modal to document.body while visible to avoid stacking-context issues
            const originalParent = modal.parentElement;
            const originalNext = modal.nextSibling;
            try { document.body.appendChild(modal); } catch (e) { /* ignore */ }

            modal.classList.remove('hidden');

            function cleanup() {
                modal.classList.add('hidden');
                yesBtn.removeEventListener('click', onYes);
                noBtn.removeEventListener('click', onNo);
                // restore original DOM position
                try {
                    if (originalParent) {
                        if (originalNext) originalParent.insertBefore(modal, originalNext);
                        else originalParent.appendChild(modal);
                    }
                } catch (e) { /* ignore */ }
            }

            function onYes() { cleanup(); resolve(true); }
            function onNo() { cleanup(); resolve(false); }

            yesBtn.addEventListener('click', onYes);
            noBtn.addEventListener('click', onNo);
        });
    }
});

// --- Mini preview width toggle (outside main ready handler to be resilient) ---
(function() {
    try {
    const preview = document.getElementById('bgMiniPreview');
    const toggle = document.getElementById('bgPreviewToggle');
    const bgCheckbox = document.getElementById('bgEnableToggle');
    const bgToggleBtn = document.getElementById('bgEnableToggleBtn');
    // don't bail early: wire each control only if present

        // Width toggle (only if both elements exist)
        if (preview && toggle) {
            // Initialize: if preview is full-width in markup, reflect that
            function updateButton() {
                if (preview.classList.contains('full-width')) {
                    toggle.textContent = 'Compact';
                    toggle.classList.add('primary');
                } else {
                    toggle.textContent = 'Width';
                    toggle.classList.remove('primary');
                }
            }

            toggle.addEventListener('click', (e) => {
                e.preventDefault();
                preview.classList.toggle('full-width');
                updateButton();
            });
        }

        // Wire the new background toggle button to the hidden checkbox so existing handlers run
        if (bgToggleBtn && bgCheckbox) {
            function updateBgBtn() {
                if (bgCheckbox.checked) {
                    bgToggleBtn.classList.add('primary');
                    bgToggleBtn.textContent = 'Background';
                } else {
                    bgToggleBtn.classList.remove('primary');
                    bgToggleBtn.textContent = 'Background';
                }
            }

            bgToggleBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                // toggle the real checkbox value and trigger change
                bgCheckbox.checked = !bgCheckbox.checked;
                const evt = new Event('change', { bubbles: true });
                bgCheckbox.dispatchEvent(evt);
                updateBgBtn();
            });

            // Keep button state in sync if checkbox changes elsewhere
            bgCheckbox.addEventListener('change', updateBgBtn);
            updateBgBtn();
        }

    // Show/Hide sliders button
        try {
            const slidersToggle = document.getElementById('bgSlidersToggle');
            const slidersWrap = document.getElementById('bgSliders');
            if (slidersToggle && slidersWrap) {
                slidersToggle.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const nowCollapsed = slidersWrap.classList.toggle('collapsed');
                    // reflect animation class using collapsible.open so transitions run
                    if (nowCollapsed) slidersWrap.classList.remove('open'); else slidersWrap.classList.add('open');
                    slidersToggle.textContent = slidersWrap.classList.contains('collapsed') ? 'Show sliders' : 'Hide sliders';

                    // add a subtle squeeze to mini preview while sliders animate
                    const mini = document.getElementById('bgMiniPreview');
                    if (mini) {
                        mini.classList.add('squeezed');
                        setTimeout(() => mini.classList.remove('squeezed'), 200);
                    }
                    updateOptionsSingleClass();
                });
            }
        } catch (err) { /* ignore */ }

    // Show/Hide mini preview button (robust)
        try {
            const miniToggle = document.getElementById('bgMiniToggleBtn');
            const miniPreview = document.getElementById('bgMiniPreview');
            if (miniToggle) {
                // Note: re-query `#bgMiniPreview` on each action to be robust
                function updateMiniBtn() {
                    const el = document.getElementById('bgMiniPreview');
                    const hidden = el ? (el.classList.contains('hidden') || el.getAttribute('aria-hidden') === 'true') : true;
                    miniToggle.textContent = hidden ? 'Show preview' : 'Hide preview';
                }

                miniToggle.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const el = document.getElementById('bgMiniPreview');
                    if (!el) return;
                    const isOpen = el.classList.contains('open');
                        if (!isOpen) {
                        // If element was display:none due to `.hidden`, remove it first
                        el.classList.remove('hidden');
                        // force reflow so the transition from max-height:0 -> max-height:N triggers
                        // eslint-disable-next-line no-unused-expressions
                        void el.offsetHeight;
                        // open via collapsible.open so CSS animates
                        el.classList.add('open');
                        el.setAttribute('aria-hidden', 'false');
                        // (mini preview is runtime-only; do not persist)
                    } else {
                        // close by removing .open, keep .hidden until animation finishes
                        el.classList.remove('open');
                        el.setAttribute('aria-hidden', 'true');
                        // (mini preview is runtime-only; do not persist)
                        // after transition, mark hidden for accessibility/flow
                        // allow a small buffer beyond the CSS duration
                        setTimeout(() => { el.classList.add('hidden'); }, 320);
                    }
                    // tiny squeeze feedback when toggling
                    el.classList.add('squeezed');
                    setTimeout(() => el.classList.remove('squeezed'), 200);
                    updateMiniBtn();
                    // ensure currentWebhook saved and UI updated
                    updateUI();
                    updateOptionsSingleClass();
                });

                // initialize button text
                updateMiniBtn();
            }
        } catch (err) { /* ignore */ }

        // More button: ensure initial hidden state is respected (no inline style should force it visible)
        try {
            const moreBtn = document.getElementById('bgMoreToggle');
            const bgOptions = document.getElementById('bgOptions');
            const topRow = document.querySelector('.bg-controls .top-row');
            if (moreBtn && bgOptions && topRow) {
                // ensure initial collapsed state
                bgOptions.classList.add('hidden');
                bgOptions.classList.remove('open');
                bgOptions.setAttribute('aria-hidden', 'true');
                topRow.classList.remove('options-open');

                function updateMoreBtn() {
                    const hidden = bgOptions.classList.contains('hidden') || bgOptions.getAttribute('aria-hidden') === 'true';
                    moreBtn.textContent = hidden ? 'More' : 'Less';
                }

                moreBtn.addEventListener('click', (ev) => {
                    ev.preventDefault();
                    const currentlyHidden = bgOptions.classList.contains('hidden') || bgOptions.getAttribute('aria-hidden') === 'true';
                    if (currentlyHidden) {
                        bgOptions.classList.remove('hidden');
                        bgOptions.classList.add('open');
                        bgOptions.setAttribute('aria-hidden', 'false');
                        topRow.classList.add('options-open');
                        // visually emphasize the more button when expanded
                        moreBtn.classList.add('active');
                    } else {
                        bgOptions.classList.add('hidden');
                        bgOptions.classList.remove('open');
                        bgOptions.setAttribute('aria-hidden', 'true');
                        topRow.classList.remove('options-open');
                        moreBtn.classList.remove('active');
                    }
                    updateMoreBtn();
                    // ensure options layout adapts if only one button is visible
                    updateOptionsSingleClass();
                });

                // initialize
                updateMoreBtn();
                updateOptionsSingleClass();
            }
        } catch (err) { /* ignore */ }

        // Helper to mark #bgOptions.single when only one visible option exists
        function updateOptionsSingleClass() {
            try {
                const opts = document.getElementById('bgOptions');
                if (!opts) return;
                const btns = Array.from(opts.querySelectorAll('.btn'));
                const visible = btns.filter(b => b.offsetParent !== null && getComputedStyle(b).display !== 'none');
                if (visible.length === 1) opts.classList.add('single'); else opts.classList.remove('single');
            } catch (e) { /* ignore */ }
        }

        updateButton();
    } catch (err) { /* ignore errors */ }
})();

// Safety init: enforce default hidden states on DOMContentLoaded to avoid flashes
document.addEventListener('DOMContentLoaded', () => {
    try {
        const bgOptions = document.getElementById('bgOptions');
        const moreBtn = document.getElementById('bgMoreToggle');
        const miniPreview = document.getElementById('bgMiniPreview');
        const miniToggle = document.getElementById('bgMiniToggleBtn');
        if (bgOptions) {
            // enforce hidden state
            bgOptions.classList.add('hidden');
            bgOptions.setAttribute('aria-hidden', 'true');
        }

        if (moreBtn) {
            moreBtn.textContent = 'More';
        }

        if (miniPreview) {
            // ensure mini preview hidden by default
            miniPreview.classList.add('hidden');
            miniPreview.setAttribute('aria-hidden', 'true');
        }

        if (miniToggle) {
            miniToggle.textContent = 'Show preview';
        }
    } catch (e) { /* ignore */ }
});

// Mini-preview sliders wiring
(function() {
    try {
        const miniSlidersToggle = document.getElementById('bgMiniSlidersToggle');
        const miniSlidersWrap = document.getElementById('bgMiniSliders');
        const mini = document.getElementById('bgMiniPreview');
        const miniOpacity = document.getElementById('miniOpacityRange');
        const miniBlur = document.getElementById('miniBlurRange');
        const miniPosH = document.getElementById('miniPosHRange');
        const miniPosV = document.getElementById('miniPosVRange');
        const miniRotate = document.getElementById('miniRotateRange');

        if (miniSlidersToggle && miniSlidersWrap) {
            miniSlidersToggle.addEventListener('click', (ev) => {
                ev.preventDefault();
                const collapsed = miniSlidersWrap.classList.toggle('collapsed');
                if (collapsed) miniSlidersWrap.classList.remove('open'); else miniSlidersWrap.classList.add('open');
                miniSlidersToggle.textContent = miniSlidersWrap.classList.contains('collapsed') ? 'Show mini sliders' : 'Hide mini sliders';

                // add squeeze to mini preview while sliders animate
                if (mini) {
                    mini.classList.add('squeezed');
                    setTimeout(() => mini.classList.remove('squeezed'), 200);
                }
                    updateOptionsSingleClass();
            });
        }

        // Initialize values and listeners
        if (mini) {
            // helper to apply styles
            const applyMiniStyles = () => {
                try {
                    const op = miniOpacity ? parseFloat(miniOpacity.value) : parseFloat(mini.style.opacity || 1);
                    const bl = miniBlur ? parseInt(miniBlur.value, 10) : 0;
                    const ph = miniPosH ? parseInt(miniPosH.value, 10) : 50;
                    const pv = miniPosV ? parseInt(miniPosV.value, 10) : 50;
                    const rt = miniRotate ? parseInt(miniRotate.value, 10) : 0;

                    mini.style.opacity = op;
                    mini.style.filter = `blur(${bl}px)`;
                    mini.style.backgroundPosition = `${ph}% ${pv}%`;
                    mini.style.transform = `rotate(${rt}deg)`;

                    // (mini preview styles applied runtime; not persisted to webhook)
                } catch (e) { /* ignore */ }
            };

            if (miniOpacity) miniOpacity.addEventListener('input', () => { applyMiniStyles(); });
            if (miniBlur) miniBlur.addEventListener('input', () => { applyMiniStyles(); });
            if (miniPosH) miniPosH.addEventListener('input', () => { applyMiniStyles(); });
            if (miniPosV) miniPosV.addEventListener('input', () => { applyMiniStyles(); });
            if (miniRotate) miniRotate.addEventListener('input', () => { applyMiniStyles(); });

            // set defaults
            if (miniOpacity) miniOpacity.value = 1;
            if (miniBlur) miniBlur.value = 0;
            if (miniPosH) miniPosH.value = 50;
            if (miniPosV) miniPosV.value = 50;
            if (miniRotate) miniRotate.value = 0;
            applyMiniStyles();
        }
    } catch (err) { /* ignore */ }
})();