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
        
        if (webhookAvatarLeft) {
            webhookAvatarLeft.src = leftAvatar === 'custom' && leftCustomAvatar ? 
                leftCustomAvatar : getAvatarUrl(leftAvatar);
        }
        
        if (webhookAvatarRight) {
            webhookAvatarRight.src = rightAvatar === 'custom' && rightCustomAvatar ? 
                rightCustomAvatar : getAvatarUrl(rightAvatar);
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
    const config = {
        categories,
        avatarPreferences: {
            leftAvatar,
            rightAvatar,
            leftCustomAvatar,
            rightCustomAvatar
        },
        savedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = CONFIG_FILE_NAME;
    a.click();
}

function importConfiguration(file) {
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            categories = config.categories || [];
            if (config.avatarPreferences) {
                leftAvatar = config.avatarPreferences.leftAvatar || 'default';
                rightAvatar = config.avatarPreferences.rightAvatar || 'default';
                leftCustomAvatar = config.avatarPreferences.leftCustomAvatar || null;
                rightCustomAvatar = config.avatarPreferences.rightCustomAvatar || null;
            }
            updateUI();
            showNotification('Configuration imported successfully!');
        } catch (err) {
            showNotification('Error importing configuration', true);
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
        
        const files = Array.from(fileInput.files);
        
        if (!files || files.length === 0) {
            showNotification('Please select at least one file.', true);
            return;
        }

        responseDiv.textContent = 'Uploading files...';
        responseDiv.style.color = '';
        previewContainer.innerHTML = '';

        try {
            const formData = new FormData();
            files.forEach(file => {
                formData.append('files', file);
            });

            const response = await fetch(currentWebhook.url, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const responseData = await response.json();
            
            if (responseData.attachments && responseData.attachments.length > 0) {
                responseData.attachments.forEach((attachment, index) => {
                    const file = files[index];
                    const previewElement = createPreviewElement(file, attachment.url);
                    previewContainer.appendChild(previewElement);
                });
                
                showNotification(`Successfully uploaded ${responseData.attachments.length} files!`);
            } else {
                showNotification('Upload completed but no file URLs returned.', true);
            }
        } catch (error) {
            console.error('Error uploading files:', error);
            showNotification('Error uploading files. Check console for details.', true);
        }
    });

    // Event Listeners básicos
    fileInput.addEventListener('change', function() {
        previewContainer.innerHTML = '';
        
        if (!this.files || this.files.length === 0) return;
        
        Array.from(this.files).forEach(file => {
            const previewElement = document.createElement('div');
            previewElement.className = 'preview-item';
            
            const reader = new FileReader();
            
            reader.onload = function(e) {
                let mediaContent = '';
                if (file.type.startsWith('image/')) {
                    mediaContent = `<img src="${e.target.result}" alt="${file.name}" class="preview-media">`;
                } else if (file.type.startsWith('video/')) {
                    mediaContent = `<video controls class="preview-media"><source src="${e.target.result}" type="${file.type}"></video>`;
                } else {
                    mediaContent = `<div class="file-icon">📄</div>`;
                }
                
                previewElement.innerHTML = `
                    ${mediaContent}
                    <p class="file-name" title="${file.name}">${file.name}</p>
                    <p class="file-size">${(file.size / 1024 / 1024).toFixed(2)} MB</p>
                `;
            };
            
            reader.readAsDataURL(file);
            previewContainer.appendChild(previewElement);
        });
    });

    addCategoryBtn.addEventListener('click', () => {
        if (currentCategory) {
            showForm(categoryForm, true);
            saveCategoryBtn.onclick = editCategory;
            categoryNameInput.value = currentCategory.name;
        } else {
            showForm(categoryForm, true);
            saveCategoryBtn.onclick = addCategory;
            categoryNameInput.value = '';
        }
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

    addWebhookBtn.addEventListener('click', () => {
        if (!currentCategory) return;
        
        if (currentWebhook) {
            showForm(webhookForm, true);
            saveWebhookBtn.onclick = editWebhook;
            webhookNameInput.value = currentWebhook.name;
            webhookUrlInput.value = currentWebhook.url;
        } else {
            showForm(webhookForm, true);
            saveWebhookBtn.onclick = addWebhook;
            webhookNameInput.value = '';
            webhookUrlInput.value = '';
        }
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
});