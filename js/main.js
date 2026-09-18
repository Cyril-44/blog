document.addEventListener('DOMContentLoaded', () => {
  // 1. Reading Progress Bar
  const progressBar = document.getElementById('reading-progress');
  if (progressBar) {
    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      progressBar.style.width = scrolled + '%';
    });
  }

  // 2. Dark / Light Scheme Mode Toggle (Desktop sidebar button + Mobile topbar button)
  function applySchemeToggle(htmlEl) {
    const current = htmlEl.getAttribute('data-scheme');
    const next = current === 'dark' ? 'light' : 'dark';
    htmlEl.setAttribute('data-scheme', next);
    localStorage.setItem('chirpy_scheme', next);
  }

  const modeBtn = document.getElementById('mode-toggle');
  if (modeBtn) {
    modeBtn.addEventListener('click', () => applySchemeToggle(document.documentElement));
  }

  const modeBtnMobile = document.getElementById('mode-toggle-mobile');
  if (modeBtnMobile) {
    modeBtnMobile.addEventListener('click', () => applySchemeToggle(document.documentElement));
  }

  const savedScheme = localStorage.getItem('chirpy_scheme');
  if (savedScheme && (savedScheme === 'dark' || savedScheme === 'light')) {
    document.documentElement.setAttribute('data-scheme', savedScheme);
  } else {
    const hours = new Date().getHours();
    const timeBasedScheme = (hours >= 18 || hours < 6) ? 'dark' : 'light';
    document.documentElement.setAttribute('data-scheme', timeBasedScheme);
  }


  // 3. Mobile Sidebar Drawer Toggle
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebarClose = document.getElementById('sidebar-close');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  function openSidebar() {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.add('open');
    sidebarOverlay.classList.add('active');
    document.body.style.overflow = 'hidden'; // Prevent background scroll
  }

  function closeSidebar() {
    if (!sidebar || !sidebarOverlay) return;
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      if (sidebar && sidebar.classList.contains('open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  if (sidebarClose) {
    sidebarClose.addEventListener('click', closeSidebar);
  }

  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', closeSidebar);
  }

  // Close sidebar on window resize if going back to desktop
  window.addEventListener('resize', () => {
    if (window.innerWidth > 768) {
      closeSidebar();
    }
  });

  // 3. One-click Code Copy Button (Fixed: No duplicates, top-right placement)
  document.querySelectorAll('figure.highlight:not(.mermaid), pre:not(.highlight pre):not(.mermaid)').forEach((block) => {
    if (block.querySelector('.copy-code-btn')) return; // Avoid duplicate injection

    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.innerText = '复制';
    block.appendChild(btn);

    btn.addEventListener('click', () => {
      const codeEl = block.querySelector('td.code') || block.querySelector('code') || block;
      let text = codeEl.innerText || '';
      text = text.replace(/^复制\n|^已复制!\n/, '').trim();
      navigator.clipboard.writeText(text).then(() => {
        btn.innerText = '已复制!';
        setTimeout(() => { btn.innerText = '复制'; }, 2000);
      });
    });
  });

  // 4. Dynamic TOC Highlight on Scroll
  const tocLinks = document.querySelectorAll('.toc-content a');
  if (tocLinks.length > 0) {
    const headings = Array.from(document.querySelectorAll('.post-content h2, .post-content h3, .post-content h4'));
    window.addEventListener('scroll', () => {
      const top = window.scrollY;
      headings.forEach((h) => {
        if (top >= h.offsetTop - 100) {
          tocLinks.forEach((link) => link.classList.remove('active'));
          const activeLink = document.querySelector(`.toc-content a[href="#${encodeURIComponent(h.id)}"]`) ||
                             document.querySelector(`.toc-content a[href="#${h.id}"]`);
          if (activeLink) activeLink.classList.add('active');
        }
      });
    });
  }

  // 5. Right Sidebar Global Title Search Dropdown (search.json)
  const searchInput = document.getElementById('sidebar-search-input');
  const searchDropdown = document.getElementById('search-results-dropdown');
  let searchPostsCache = null;

  if (searchInput && searchDropdown) {
    const fetchSearchPosts = async () => {
      if (searchPostsCache) return searchPostsCache;
      try {
        const rootUrl = window.location.pathname.startsWith('/hexo-theme-chirpy') ? '/hexo-theme-chirpy' : '';
        const res = await fetch(rootUrl + '/search.json');
        if (res.ok) {
          searchPostsCache = await res.json();
          return searchPostsCache;
        }
      } catch (e) {}
      return [];
    };

    searchInput.addEventListener('focus', () => {
      fetchSearchPosts();
    });

    searchInput.addEventListener('input', async (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        searchDropdown.style.display = 'none';
        searchDropdown.innerHTML = '';
        return;
      }

      const posts = await fetchSearchPosts();
      const matched = posts.filter((p) => p.title.toLowerCase().includes(q));

      if (matched.length === 0) {
        searchDropdown.innerHTML = '<div class="search-no-result">未找到匹配的标题文章</div>';
      } else {
        searchDropdown.innerHTML = matched
          .slice(0, 10)
          .map(
            (p) => `
          <a href="${p.path}" class="search-result-item">
            <span class="search-result-title">${p.title}</span>
            ${p.date ? `<span class="search-result-date">${p.date}</span>` : ''}
          </a>
        `
          )
          .join('');
      }

      searchDropdown.style.display = 'block';
    });

    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !searchDropdown.contains(e.target)) {
        searchDropdown.style.display = 'none';
      }
    });

  }



  // 6. Interactive Mermaid Diagram Scaling, Drag & Pan Handlers
  const mermaidBlocks = document.querySelectorAll('figure.highlight.mermaid, code.language-mermaid, pre.mermaid, .mermaid');

  if (mermaidBlocks.length > 0) {
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js';
    script.onload = () => {
      const isDark = document.documentElement.getAttribute('data-scheme') === 'dark';
      mermaid.initialize({
        startOnLoad: false,
        theme: isDark ? 'dark' : 'default',
        securityLevel: 'loose'
      });

      mermaidBlocks.forEach((block, index) => {
        const codeText = block.innerText || block.textContent || '';
        if (!codeText.trim()) return;

        const container = document.createElement('div');
        container.className = 'mermaid-control-wrapper';

        const toolbar = document.createElement('div');
        toolbar.className = 'mermaid-toolbar';
        toolbar.innerHTML = `
          <button class="mermaid-btn btn-zoom-in" title="放大"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
          <button class="mermaid-btn btn-zoom-out" title="缩小"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
          <button class="mermaid-btn btn-reset" title="重置比例 (70%)"><i class="fa-solid fa-rotate-left"></i> 70%</button>
          <button class="mermaid-btn btn-fullscreen" title="全屏查看"><i class="fa-solid fa-expand"></i> 全屏</button>
        `;

        const svgBox = document.createElement('div');
        svgBox.className = 'mermaid-svg-box';

        container.appendChild(toolbar);
        container.appendChild(svgBox);

        block.replaceWith(container);

        const id = `mermaid-id-${index}-${Date.now()}`;
        mermaid.render(id, codeText).then(({ svg }) => {
          svgBox.innerHTML = svg;

          let currentScale = 0.7;
          let translateX = 0;
          let translateY = 0;
          let isDragging = false;
          let startX = 0;
          let startY = 0;
          let initialX = 0;
          let initialY = 0;

          const updateTransform = (smooth = true) => {
            const svgEl = svgBox.querySelector('svg');
            if (svgEl) {
              svgEl.style.transform = `translate(${translateX}px, ${translateY}px) scale(${currentScale})`;
              svgEl.style.transformOrigin = 'center center';
              svgEl.style.transition = smooth && !isDragging ? 'transform 0.2s ease-out' : 'none';
            }
          };

          updateTransform(true);

          // Mouse Drag & Touch Pan Gestures
          svgBox.style.cursor = 'grab';
          svgBox.style.userSelect = 'none';

          const onPointerDown = (e) => {
            isDragging = true;
            svgBox.style.cursor = 'grabbing';
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            startX = clientX;
            startY = clientY;
            initialX = translateX;
            initialY = translateY;
          };

          const onPointerMove = (e) => {
            if (!isDragging) return;
            const clientX = e.touches ? e.touches[0].clientX : e.clientX;
            const clientY = e.touches ? e.touches[0].clientY : e.clientY;
            const dx = clientX - startX;
            const dy = clientY - startY;
            translateX = initialX + dx;
            translateY = initialY + dy;
            updateTransform(false);
          };

          const onPointerUp = () => {
            if (isDragging) {
              isDragging = false;
              svgBox.style.cursor = 'grab';
            }
          };

          svgBox.addEventListener('mousedown', onPointerDown);
          window.addEventListener('mousemove', onPointerMove);
          window.addEventListener('mouseup', onPointerUp);

          svgBox.addEventListener('touchstart', onPointerDown, { passive: true });
          window.addEventListener('touchmove', onPointerMove, { passive: true });
          window.addEventListener('touchend', onPointerUp);

          // Mouse Wheel Zoom
          svgBox.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            currentScale = Math.min(3.0, Math.max(0.2, currentScale + delta));
            updateTransform(true);
          }, { passive: false });

          // Toolbar Buttons
          toolbar.querySelector('.btn-zoom-in')?.addEventListener('click', () => {
            currentScale = Math.min(3.0, currentScale + 0.15);
            updateTransform(true);
          });

          toolbar.querySelector('.btn-zoom-out')?.addEventListener('click', () => {
            currentScale = Math.max(0.2, currentScale - 0.15);
            updateTransform(true);
          });

          toolbar.querySelector('.btn-reset')?.addEventListener('click', () => {
            currentScale = 0.7;
            translateX = 0;
            translateY = 0;
            updateTransform(true);
          });

          toolbar.querySelector('.btn-fullscreen')?.addEventListener('click', () => {
            openMermaidModal(svg);
          });
        }).catch(() => {});
      });
    };
    document.head.appendChild(script);
  }

  // Fullscreen Modal for Mermaid SVG with Pan, Drag & Wheel Zoom
  function openMermaidModal(svgHtml) {
    let modal = document.getElementById('mermaid-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'mermaid-modal';
      modal.className = 'mermaid-modal';
      modal.innerHTML = `
        <div class="mermaid-modal-backdrop"></div>
        <div class="mermaid-modal-content">
          <div class="mermaid-modal-toolbar">
            <button class="mermaid-btn btn-modal-zoom-in" title="放大"><i class="fa-solid fa-magnifying-glass-plus"></i> 放大</button>
            <button class="mermaid-btn btn-modal-zoom-out" title="缩小"><i class="fa-solid fa-magnifying-glass-minus"></i> 缩小</button>
            <button class="mermaid-btn btn-modal-reset" title="重置位置与缩放"><i class="fa-solid fa-rotate-left"></i> 重置 100%</button>
            <button class="mermaid-btn btn-modal-close" title="关闭 (Esc)"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="mermaid-modal-body"></div>
        </div>
      `;
      document.body.appendChild(modal);

      const closeModal = () => {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      };

      modal.querySelector('.mermaid-modal-backdrop')?.addEventListener('click', closeModal);
      modal.querySelector('.btn-modal-close')?.addEventListener('click', closeModal);

      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          closeModal();
        }
      });
    }

    const modalBody = modal.querySelector('.mermaid-modal-body');
    if (modalBody) {
      modalBody.innerHTML = svgHtml;
      const svgEl = modalBody.querySelector('svg');

      if (svgEl) {
        svgEl.removeAttribute('style');
        svgEl.style.maxWidth = '100%';
        svgEl.style.maxHeight = '100%';
        svgEl.style.width = 'auto';
        svgEl.style.height = 'auto';
        svgEl.style.objectFit = 'contain';

        let mScale = 1.0;
        let mTx = 0;
        let mTy = 0;
        let mIsDragging = false;
        let mStartX = 0;
        let mStartY = 0;
        let mInitX = 0;
        let mInitY = 0;

        const updateModalTransform = (smooth = true) => {
          svgEl.style.transform = `translate(${mTx}px, ${mTy}px) scale(${mScale})`;
          svgEl.style.transformOrigin = 'center center';
          svgEl.style.transition = smooth && !mIsDragging ? 'transform 0.2s ease-out' : 'none';
        };

        updateModalTransform(true);

        const onModalPointerDown = (e) => {
          mIsDragging = true;
          modalBody.style.cursor = 'grabbing';
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          mStartX = clientX;
          mStartY = clientY;
          mInitX = mTx;
          mInitY = mTy;
        };

        const onModalPointerMove = (e) => {
          if (!mIsDragging) return;
          const clientX = e.touches ? e.touches[0].clientX : e.clientX;
          const clientY = e.touches ? e.touches[0].clientY : e.clientY;
          const dx = clientX - mStartX;
          const dy = clientY - mStartY;
          mTx = mInitX + dx;
          mTy = mInitY + dy;
          updateModalTransform(false);
        };

        const onModalPointerUp = () => {
          if (mIsDragging) {
            mIsDragging = false;
            modalBody.style.cursor = 'grab';
          }
        };

        modalBody.onmousedown = onModalPointerDown;
        modalBody.ontouchstart = onModalPointerDown;
        window.onmousemove = (e) => { if (mIsDragging) onModalPointerMove(e); };
        window.ontouchmove = (e) => { if (mIsDragging) onModalPointerMove(e); };
        window.onmouseup = onModalPointerUp;
        window.ontouchend = onModalPointerUp;

        modalBody.onwheel = (e) => {
          e.preventDefault();
          const delta = e.deltaY > 0 ? -0.15 : 0.15;
          mScale = Math.min(5.0, Math.max(0.2, mScale + delta));
          updateModalTransform(true);
        };

        modal.querySelector('.btn-modal-zoom-in').onclick = () => {
          mScale = Math.min(5.0, mScale + 0.2);
          updateModalTransform(true);
        };
        modal.querySelector('.btn-modal-zoom-out').onclick = () => {
          mScale = Math.max(0.2, mScale - 0.2);
          updateModalTransform(true);
        };
        modal.querySelector('.btn-modal-reset').onclick = () => {
          mScale = 1.0;
          mTx = 0;
          mTy = 0;
          updateModalTransform(true);
        };
      }
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  }



});
