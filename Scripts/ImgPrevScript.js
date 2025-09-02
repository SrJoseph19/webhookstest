
        // Script adicional para manejar el modal unificado
        document.addEventListener('DOMContentLoaded', function() {
            // Elementos del modal
            const avatarModal = document.getElementById('avatarModal');
            const avatarModalTitle = document.getElementById('avatarModalTitle');
            const avatarModalClose = document.querySelector('.avatar-modal-close');
            const avatarModalCancel = document.getElementById('avatarModalCancel');
            const avatarModalConfirm = document.getElementById('avatarModalConfirm');
            const avatarModalFileInput = document.getElementById('avatarModalFileInput');
            const avatarModalCustomBtn = document.getElementById('avatarModalCustomBtn');
            const avatarModalCustomPreview = document.getElementById('avatarModalCustomPreview');
            const avatarModalCustomImg = document.getElementById('avatarModalCustomImg');
            const avatarOptions = document.querySelectorAll('.avatar-modal-option');
            
            // Variables de estado
            let currentAvatarContext = null; // 'webhook', 'left', 'right'
            let selectedAvatarType = 'default';
            let selectedAvatarFile = null;
            let selectedAvatarUrl = 'images/default-avatar.png';
            
            // Función para abrir el modal
            function openAvatarModal(context, currentAvatar) {
                currentAvatarContext = context;
                
                // Configurar título según el contexto
                if (context === 'webhook') {
                    avatarModalTitle.textContent = 'Select Webhook Avatar';
                } else {
                    avatarModalTitle.textContent = `Select ${context.charAt(0).toUpperCase() + context.slice(1)} Avatar`;
                }
                
                // Resetear selección
                resetAvatarModal();
                
                // Seleccionar la opción actual si existe
                if (currentAvatar) {
                    selectAvatarOption(currentAvatar);
                }
                
                // Mostrar modal
                avatarModal.style.display = 'flex';
            }
            
            // Función para cerrar el modal
            function closeAvatarModal() {
                avatarModal.style.display = 'none';
                resetAvatarModal();
            }
            
            // Función para resetear el modal
            function resetAvatarModal() {
                selectedAvatarType = 'default';
                selectedAvatarFile = null;
                selectedAvatarUrl = 'images/default-avatar.png';
                
                // Deseleccionar todas las opciones
                avatarOptions.forEach(option => {
                    option.classList.remove('selected');
                });
                
                // Seleccionar la opción por defecto
                document.querySelector('.avatar-modal-option[data-avatar="default"]').classList.add('selected');
                
                // Ocultar preview personalizado
                avatarModalCustomPreview.classList.add('hidden');
                avatarModalFileInput.value = '';
            }
            
            // Función para seleccionar una opción de avatar
            function selectAvatarOption(avatarType) {
                selectedAvatarType = avatarType;
                
                // Actualizar selección visual
                avatarOptions.forEach(option => {
                    option.classList.remove('selected');
                    if (option.getAttribute('data-avatar') === avatarType) {
                        option.classList.add('selected');
                    }
                });
                
                // Si es un avatar predefinido, establecer la URL 
                if (avatarType !== 'custom') {
                    const avatarMap = {
                        'default': 'images/default-avatar.png',
                        'default2': 'images/default-avatar1.png',
                        'default3': 'images/default-avatar2.png'
                    };
                    selectedAvatarUrl = avatarMap[avatarType] || 'images/default-avatar.png';
                    selectedAvatarFile = null;
                    avatarModalCustomPreview.classList.add('hidden');
                }
            }
            
            // Función para aplicar el avatar seleccionado
            function applySelectedAvatar() {
                const detail = {
                    context: currentAvatarContext, // 'webhook' | 'left' | 'right'
                    avatarType: selectedAvatarType, // 'default'|'default2'|'default3'|'custom'
                    avatarUrl: selectedAvatarUrl,   // url o dataURL si custom
                    avatarFile: selectedAvatarFile  // File object (may be null)
                };

                // Dispatch event for other script to handle persistence
                try {
                    window.dispatchEvent(new CustomEvent('avatarSelected', { detail }));
                } catch (err) {
                    console.warn('Could not dispatch avatarSelected event', err);
                }

                // Close modal
                closeAvatarModal();
            }

            // Event listeners
            avatarModalClose.addEventListener('click', closeAvatarModal);
            avatarModalCancel.addEventListener('click', closeAvatarModal);
            
            avatarModalConfirm.addEventListener('click', function() {
                applySelectedAvatar();
            });
            
            avatarModal.addEventListener('click', function(e) {
                if (e.target === avatarModal) {
                    closeAvatarModal();
                }
            });
            
            // Selección de opciones de avatar
            avatarOptions.forEach(option => {
                option.addEventListener('click', function() {
                    const avatarType = this.getAttribute('data-avatar');
                    selectAvatarOption(avatarType);
                });
            });
            
            // Subida de avatar personalizado
            avatarModalCustomBtn.addEventListener('click', function() {
                avatarModalFileInput.click();
            });
            
            avatarModalFileInput.addEventListener('change', function(e) {
                if (this.files && this.files[0]) {
                    const file = this.files[0];
                    
                    // Validar que sea una imagen
                    if (!file.type.startsWith('image/')) {
                        alert('Please select a valid image file');
                        return;
                    }
                    
                    // Leer y mostrar preview
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        selectedAvatarType = 'custom';
                        selectedAvatarFile = file;
                        selectedAvatarUrl = e.target.result;
                        
                        // Mostrar preview
                        avatarModalCustomImg.src = e.target.result;
                        avatarModalCustomPreview.classList.remove('hidden');
                        
                        // Seleccionar visualmente la opción custom
                        selectAvatarOption('custom');
                    };
                    reader.readAsDataURL(file);
                }
            });
            
            // Reemplazar los manejadores de eventos existentes para usar el modal unificado
            document.addEventListener('click', function(e) {
                // Botones de cambio de avatar en el preview
                if (e.target.closest('.avatar-change-btn')) {
                    const btn = e.target.closest('.avatar-change-btn');
                    const side = btn.getAttribute('data-side');
                    
                    // Obtener avatar actual
                    let currentAvatar = 'default';
                    if (side === 'left' && typeof leftAvatar !== 'undefined') {
                        currentAvatar = leftAvatar;
                    } else if (side === 'right' && typeof rightAvatar !== 'undefined') {
                        currentAvatar = rightAvatar;
                    }
                    
                    openAvatarModal(side, currentAvatar);
                }
            });
        });
