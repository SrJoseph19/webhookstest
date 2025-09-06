
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
                if (avatarModalCustomPreview) {
                    avatarModalCustomPreview.classList.add('hidden');
                    avatarModalCustomPreview.style.display = 'none';
                }
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

                        // Mostrar preview: set src on existing img or create one, then ensure container is visible
                        if (avatarModalCustomPreview) {
                            avatarModalCustomPreview.innerHTML = '';
                            if (avatarModalCustomImg) {
                                avatarModalCustomImg.src = e.target.result;
                                avatarModalCustomImg.style.display = '';
                                avatarModalCustomPreview.appendChild(avatarModalCustomImg);
                            } else {
                                const img = document.createElement('img');
                                img.id = 'avatarModalCustomImg';
                                img.src = e.target.result;
                                img.style.maxWidth = '100%';
                                avatarModalCustomPreview.appendChild(img);
                            }
                            avatarModalCustomPreview.classList.remove('hidden');
                            avatarModalCustomPreview.style.display = 'block';
                        }

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

            // --- Avatar preview sliders wiring ---
            // Targets: #webhookAvatarPreview and #webhookAvatarPreview2
            const avatarH = document.getElementById('avatarPosHRange');
            const avatarV = document.getElementById('avatarPosVRange');
            const avatarR = document.getElementById('avatarRotateRange');
            const avatarS = document.getElementById('avatarScaleRange');

            function applyAvatarTransforms() {
                const imgs = [];
                const a1 = document.getElementById('webhookAvatarPreview');
                const a2 = document.getElementById('webhookAvatarPreview2');
                if (a1) imgs.push(a1);
                if (a2) imgs.push(a2);

                const h = avatarH ? Number(avatarH.value) : 0;
                const v = avatarV ? Number(avatarV.value) : 0;
                const r = avatarR ? Number(avatarR.value) : 0;
                const s = avatarS ? Number(avatarS.value) / 100 : 1;

                // helper: measure transformed bounding box (accounts for rotation + scale)
                function measureTransformedSize(el, rotDeg, scale) {
                    try {
                        // create a lightweight clone to avoid mutating the real element
                        const rect = el.getBoundingClientRect();
                        const clone = el.cloneNode(true);
                        // ensure clone has same layout size as original
                        clone.style.width = rect.width + 'px';
                        clone.style.height = rect.height + 'px';
                        clone.style.margin = '0';
                        clone.style.position = 'absolute';
                        clone.style.left = '-9999px';
                        clone.style.top = '-9999px';
                        clone.style.visibility = 'hidden';
                        clone.style.transformOrigin = '50% 50%';
                        // apply rotation + scale only (no translation)
                        clone.style.transform = `rotate(${rotDeg}deg) scale(${scale})`;
                        document.body.appendChild(clone);
                        const b = clone.getBoundingClientRect();
                        document.body.removeChild(clone);
                        return { width: b.width, height: b.height };
                    } catch (e) {
                        return null;
                    }
                }

                imgs.forEach(img => {
                    try {
                        const container = img.parentElement || img.parentNode;
                        const cRect = container ? container.getBoundingClientRect() : { width: 0, height: 0 };

                        // measure transformed size (rot+scale)
                        const measured = measureTransformedSize(img, r, s);
                        let tW, tH;
                        if (measured && measured.width > 0 && measured.height > 0) {
                            tW = measured.width;
                            tH = measured.height;
                        } else {
                            // fallback to offset sizes multiplied by scale
                            const iw = img.offsetWidth || img.naturalWidth || 0;
                            const ih = img.offsetHeight || img.naturalHeight || 0;
                            tW = iw * s;
                            tH = ih * s;
                        }

                        const maxX = Math.max(0, (tW - cRect.width) / 2);
                        const maxY = Math.max(0, (tH - cRect.height) / 2);

                        const hClamped = Math.max(-maxX, Math.min(maxX, h));
                        const vClamped = Math.max(-maxY, Math.min(maxY, v));

                        if (avatarH && Number(avatarH.value) !== Math.round(hClamped)) avatarH.value = Math.round(hClamped);
                        if (avatarV && Number(avatarV.value) !== Math.round(vClamped)) avatarV.value = Math.round(vClamped);

                        img.style.transform = `translate(-50%, -50%) translate(${hClamped}px, ${vClamped}px) rotate(${r}deg) scale(${s})`;
                        img.style.transition = 'transform 120ms linear';
                    } catch (err) {
                        img.style.transform = `translate(-50%, -50%) translate(${h}px, ${v}px) rotate(${r}deg) scale(${s})`;
                        img.style.transition = 'transform 120ms linear';
                    }
                });

                // Also apply to dynamic uploaded previews inside #previewContainer
                try {
                    const dyn = document.querySelectorAll('#previewContainer .uploaded-media');
                    dyn.forEach(el => {
                        try {
                            const container = el.parentElement || el.parentNode;
                            const cRect = container ? container.getBoundingClientRect() : { width: 0, height: 0 };
                            // measure transformed size of the dynamic element
                            const measured = measureTransformedSize(el, r, s);
                            let tW, tH;
                            if (measured && measured.width > 0 && measured.height > 0) {
                                tW = measured.width;
                                tH = measured.height;
                            } else {
                                const iw = el.offsetWidth || el.naturalWidth || 0;
                                const ih = el.offsetHeight || el.naturalHeight || 0;
                                tW = iw * s;
                                tH = ih * s;
                            }

                            const maxX = Math.max(0, (tW - cRect.width) / 2);
                            const maxY = Math.max(0, (tH - cRect.height) / 2);
                            const hClamped = Math.max(-maxX, Math.min(maxX, h));
                            const vClamped = Math.max(-maxY, Math.min(maxY, v));

                            if (avatarH && Number(avatarH.value) !== Math.round(hClamped)) avatarH.value = Math.round(hClamped);
                            if (avatarV && Number(avatarV.value) !== Math.round(vClamped)) avatarV.value = Math.round(vClamped);

                            el.style.transform = `translate(-50%, -50%) translate(${hClamped}px, ${vClamped}px) rotate(${r}deg) scale(${s})`;
                            el.style.transition = 'transform 120ms linear';
                        } catch (err) {
                            el.style.transform = `translate(-50%, -50%) translate(${h}px, ${v}px) rotate(${r}deg) scale(${s})`;
                            el.style.transition = 'transform 120ms linear';
                        }
                    });
                } catch (e) {
                    // ignore if preview container not present
                }
            }

            // Wire inputs and persist per-webhook when changed
            if (avatarH) avatarH.addEventListener('input', function() {
                applyAvatarTransforms();
                if (window.savePreviewOffset) window.savePreviewOffset({ x: Number(avatarH.value), y: Number(avatarV?.value||0), rotate: Number(avatarR?.value||0), scale: Number(avatarS?.value?avatarS.value/100:1) });
            });
            if (avatarV) avatarV.addEventListener('input', function() {
                applyAvatarTransforms();
                if (window.savePreviewOffset) window.savePreviewOffset({ x: Number(avatarH?.value||0), y: Number(avatarV.value), rotate: Number(avatarR?.value||0), scale: Number(avatarS?.value?avatarS.value/100:1) });
            });
            if (avatarR) avatarR.addEventListener('input', function() {
                applyAvatarTransforms();
                if (window.savePreviewOffset) window.savePreviewOffset({ x: Number(avatarH?.value||0), y: Number(avatarV?.value||0), rotate: Number(avatarR.value), scale: Number(avatarS?.value?avatarS.value/100:1) });
            });
            if (avatarS) avatarS.addEventListener('input', function() {
                applyAvatarTransforms();
                if (window.savePreviewOffset) window.savePreviewOffset({ x: Number(avatarH?.value||0), y: Number(avatarV?.value||0), rotate: Number(avatarR?.value||0), scale: Number(avatarS.value/100) });
            });

            // Initialize on load
            document.addEventListener('DOMContentLoaded', function() {
                // ensure sliders reflect 0 default and apply transforms once
                setTimeout(applyAvatarTransforms, 30);
            });

            // Toggle button for avatar sliders visibility
            const avatarSlidersContainer = document.getElementById('avatarSliders');
            const avatarSlidersToggleBtn = document.getElementById('bgAvatarSlidersToggle');
            if (avatarSlidersToggleBtn && avatarSlidersContainer) {
                avatarSlidersToggleBtn.addEventListener('click', function() {
                    const isCollapsed = avatarSlidersContainer.classList.contains('collapsed');
                    if (isCollapsed) {
                        avatarSlidersContainer.classList.remove('collapsed');
                        avatarSlidersContainer.classList.add('open');
                        avatarSlidersContainer.setAttribute('aria-hidden', 'false');
                    } else {
                        avatarSlidersContainer.classList.add('collapsed');
                        avatarSlidersContainer.classList.remove('open');
                        avatarSlidersContainer.setAttribute('aria-hidden', 'true');
                    }
                });
            }
        });
