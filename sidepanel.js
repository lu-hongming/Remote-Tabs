class DeviceTabsSidebar {
  constructor() {
    this.devices = new Map();
    this.searchInput = document.getElementById("searchInput");
    this.searchClear = document.getElementById("searchClear");
    this.searchContainer = document.getElementById("searchContainer");
    this.searchTrigger = document.getElementById("searchTrigger");
    this.searchExpanded = document.getElementById("searchExpanded");
    this.deviceDropdown = document.getElementById("deviceDropdown");
    this.deviceDropdownTrigger = document.getElementById(
      "deviceDropdownTrigger"
    );
    this.deviceDropdownMenu = document.getElementById("deviceDropdownMenu");
    this.deviceHeaderName = document.getElementById("deviceHeaderName");
    this.deviceHeaderCount = document.getElementById("deviceHeaderCount");
    this.deviceDropdownIcon = document.getElementById("deviceDropdownIcon");
    this.devicesContainer = document.getElementById("devicesContainer");
    this.content = document.querySelector(".content");
    this.emptyState = document.getElementById("emptyState");
    this.expandedDevices = new Set();
    this.lastSyncTime = null;
    this.searchQuery = "";
    this.selectedDevice = null;
    this.allDevices = new Map();
    this.contextMenu = document.getElementById("contextMenu");
    this.currentContextTab = null;
    this.searchExpanded = false;

    this.init();
  }

  async init() {
    this.setupEventListeners();
    await this.loadStoredState();
    await this.loadDevicesAndTabs();
    this.setupAutoRefresh();
    this.setupImageErrorHandling();
  }

  setupEventListeners() {
    // Enhanced search functionality
    this.searchTrigger.addEventListener("click", () => {
      this.toggleSearch();
    });

    this.searchInput.addEventListener("input", (e) => {
      this.searchQuery = e.target.value;
      this.filterTabs(this.searchQuery);
      this.toggleSearchClear();
    });

    this.searchInput.addEventListener("blur", () => {
      // Delay collapse to allow for clear button click
      setTimeout(() => {
        if (!this.searchQuery && this.searchExpanded) {
          this.collapseSearch();
        }
      }, 150);
    });

    this.searchClear.addEventListener("click", () => {
      this.searchInput.value = "";
      this.searchQuery = "";
      this.filterTabs("");
      this.toggleSearchClear();
      this.searchInput.focus();
    });

    // Device dropdown functionality
    this.deviceDropdownTrigger.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggleDeviceDropdown();
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.deviceDropdown.contains(e.target)) {
        this.closeDeviceDropdown();
      }
      if (
        !this.searchContainer.contains(e.target) &&
        this.searchExpanded &&
        !this.searchQuery
      ) {
        this.collapseSearch();
      }
    });

    // Device dropdown keyboard navigation
    this.deviceDropdownTrigger.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        this.toggleDeviceDropdown();
      }
    });

    // Refresh button
    const refreshBtn = document.getElementById("refreshBtn");
    if (refreshBtn) {
      refreshBtn.addEventListener("click", () => {
        this.loadDevicesAndTabs();
      });
    }

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "f":
            e.preventDefault();
            this.searchInput.focus();
            break;
          case "r":
            e.preventDefault();
            this.loadDevicesAndTabs();
            break;
        }
      }
      if (e.key === "Escape") {
        this.searchInput.value = "";
        this.searchQuery = "";
        this.filterTabs("");
        this.toggleSearchClear();
      }
    });

    // Listen for messages from background script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (
        message.action === "tabUpdated" ||
        message.action === "tabCreated" ||
        message.action === "tabRemoved"
      ) {
        this.loadDevicesAndTabs();
      }
      if (message.action === "windowFocused") {
        this.loadDevicesAndTabs();
      }
    });

    // Event delegation for dynamic content
    this.devicesContainer.addEventListener("click", (e) => {
      const deviceHeader = e.target.closest(".device-header");
      const tabItem = e.target.closest(".tab-item");

      if (deviceHeader) {
        const deviceName = deviceHeader.closest(".device-group").dataset.device;
        this.toggleDevice(deviceName);
      } else if (tabItem) {
        const url = tabItem.dataset.url;
        this.openTab(url);
      }
    });

    // Right-click context menu for tabs
    this.devicesContainer.addEventListener("contextmenu", (e) => {
      const tabItem = e.target.closest(".tab-item");
      if (tabItem) {
        e.preventDefault();
        this.showContextMenu(e, tabItem);
      }
    });

    // Close context menu when clicking outside
    document.addEventListener("click", (e) => {
      if (!this.contextMenu.contains(e.target)) {
        this.hideContextMenu();
      }
    });

    // Close context menu on escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        this.hideContextMenu();
      }
    });

    // Keyboard navigation for device headers and tabs
    this.devicesContainer.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const deviceHeader = e.target.closest(".device-header");
        const tabItem = e.target.closest(".tab-item");

        if (deviceHeader) {
          e.preventDefault();
          const deviceName =
            deviceHeader.closest(".device-group").dataset.device;
          this.toggleDevice(deviceName);
        } else if (tabItem) {
          e.preventDefault();
          const url = tabItem.dataset.url;
          this.openTab(url);
        }
      }
    });
  }

  showContextMenu(event, tabItem) {
    this.currentContextTab = {
      url: tabItem.dataset.url,
      title: tabItem.dataset.title,
      tabId: tabItem.dataset.tabId,
      isRemote: this.selectedDevice !== "This Device",
    };

    this.renderContextMenu();

    // Position the context menu
    const rect = this.contextMenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let x = event.clientX;
    let y = event.clientY;

    // Adjust position if menu would go off-screen
    if (x + rect.width > viewportWidth) {
      x = viewportWidth - rect.width - 10;
    }
    if (y + rect.height > viewportHeight) {
      y = viewportHeight - rect.height - 10;
    }

    this.contextMenu.style.left = `${x}px`;
    this.contextMenu.style.top = `${y}px`;
    this.contextMenu.classList.add("show");
  }

  hideContextMenu() {
    this.contextMenu.classList.remove("show");
    this.currentContextTab = null;
  }

  renderContextMenu() {
    if (!this.currentContextTab) return;

    const { isRemote } = this.currentContextTab;

    const menuItems = [
      {
        icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>',
        label: "Open in New Tab",
        action: "open",
        disabled: false,
      },
      {
        icon: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15,3 21,3 21,9"/><line x1="10" y1="14" x2="21" y2="3"/>',
        label: "Open in New Window",
        action: "openWindow",
        disabled: false,
      },
      {
        separator: true,
      },
      {
        icon: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        label: "Copy URL",
        action: "copyUrl",
        disabled: false,
      },
      {
        icon: '<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
        label: "Copy Title",
        action: "copyTitle",
        disabled: false,
      },
    ];

    // Only add close tab option for current device tabs
    if (!isRemote) {
      menuItems.push(
        {
          separator: true,
        },
        {
          icon: '<polyline points="3,6 5,6 21,6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"/>',
          label: "Close Tab",
          action: "close",
          disabled: false,
        }
      );
    }

    const menuHTML = menuItems
      .map((item) => {
        if (item.separator) {
          return '<div class="context-menu-separator"></div>';
        }

        return `
        <button class="context-menu-item ${item.disabled ? "disabled" : ""}" 
                data-action="${item.action}"
                ${item.disabled ? "disabled" : ""}>
          <svg class="context-menu-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            ${item.icon}
          </svg>
          ${item.label}
        </button>
      `;
      })
      .join("");

    this.contextMenu.innerHTML = menuHTML;

    // Add click handlers
    this.contextMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".context-menu-item");
      if (item && !item.disabled) {
        const action = item.dataset.action;
        this.handleContextMenuAction(action);
        this.hideContextMenu();
      }
    });
  }

  async handleContextMenuAction(action) {
    if (!this.currentContextTab) return;

    const { url, title } = this.currentContextTab;

    try {
      switch (action) {
        case "open":
          await chrome.tabs.create({ url, active: true });
          break;

        case "openWindow":
          await chrome.windows.create({ url, focused: true });
          break;

        case "copyUrl":
          await navigator.clipboard.writeText(url);
          this.showToast("URL copied to clipboard");
          break;

        case "copyTitle":
          await navigator.clipboard.writeText(title);
          this.showToast("Title copied to clipboard");
          break;

        case "close":
          if (this.selectedDevice === "This Device") {
            // Extract tab ID for current device tabs
            const tabId = parseInt(this.currentContextTab.tabId.split("-")[1]);
            await chrome.tabs.remove(tabId);
            this.loadDevicesAndTabs(); // Refresh the list
          }
          break;
      }
    } catch (error) {
      console.error("Error handling context menu action:", error);
      this.showToast("Action failed");
    }
  }

  showToast(message) {
    // Simple toast notification
    const toast = document.createElement("div");
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 30000;
      opacity: 0;
      transition: opacity 0.2s ease;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    // Fade in
    setTimeout(() => (toast.style.opacity = "1"), 10);

    // Remove after 2 seconds
    setTimeout(() => {
      toast.style.opacity = "0";
      setTimeout(() => document.body.removeChild(toast), 200);
    }, 2000);
  }

  toggleSearch() {
    if (this.searchExpanded) {
      this.collapseSearch();
    } else {
      this.expandSearch();
    }
  }

  expandSearch() {
    this.searchExpanded = true;
    this.searchContainer.classList.add("expanded");
    setTimeout(() => {
      this.searchInput.focus();
    }, 200);
  }

  collapseSearch() {
    this.searchExpanded = false;
    this.searchContainer.classList.remove("expanded");
    this.searchInput.blur();
  }

  toggleDeviceDropdown() {
    const isOpen = this.deviceDropdown.classList.contains("open");
    if (isOpen) {
      this.closeDeviceDropdown();
    } else {
      this.openDeviceDropdown();
    }
  }

  openDeviceDropdown() {
    this.deviceDropdown.classList.add("open");
    this.renderDeviceDropdownOptions();
  }

  closeDeviceDropdown() {
    this.deviceDropdown.classList.remove("open");
  }

  renderDeviceDropdownOptions() {
    const deviceEntries = Array.from(this.allDevices.entries());

    const optionsHTML = deviceEntries
      .map(([deviceName, deviceData]) => {
        const isSelected = this.selectedDevice === deviceName;
        const deviceIcon = this.getDeviceIcon(deviceName);
        const tabCount = deviceData.tabs.length;

        return `
        <div class="device-dropdown-item ${isSelected ? "selected" : ""}" 
             data-device="${deviceName}"
             tabindex="0">
          <div class="device-dropdown-item-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              ${deviceIcon}
            </svg>
          </div>
          <div class="device-dropdown-item-info">
            <div class="device-dropdown-item-name">${this.escapeHtml(
              deviceName
            )}</div>
            <div class="device-dropdown-item-count">${tabCount} ${
          tabCount === 1 ? "tab" : "tabs"
        }</div>
          </div>
        </div>
      `;
      })
      .join("");

    this.deviceDropdownMenu.innerHTML = optionsHTML;

    // Add click handlers for dropdown items
    this.deviceDropdownMenu.addEventListener("click", (e) => {
      const item = e.target.closest(".device-dropdown-item");
      if (item) {
        const deviceName = item.dataset.device;
        this.selectDevice(deviceName);
        this.closeDeviceDropdown();
      }
    });
  }

  selectDevice(deviceName) {
    this.selectedDevice = deviceName;
    this.updateDeviceHeader();
    this.renderSelectedDeviceTabs();
    this.saveState();
  }

  updateDeviceHeader() {
    if (this.selectedDevice && this.allDevices.has(this.selectedDevice)) {
      const deviceData = this.allDevices.get(this.selectedDevice);
      const deviceIcon = this.getDeviceIcon(this.selectedDevice);
      const tabCount = deviceData.tabs.length;

      this.deviceHeaderName.textContent = this.selectedDevice;
      this.deviceHeaderCount.textContent = `${tabCount} ${
        tabCount === 1 ? "tab" : "tabs"
      }`;

      this.deviceDropdownIcon.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${deviceIcon}
        </svg>
      `;
    } else {
      this.deviceHeaderName.textContent = "Select Device";
      this.deviceHeaderCount.textContent = "0 tabs";
    }
  }

  toggleSearchClear() {
    this.searchClear.style.display = this.searchQuery ? "block" : "none";
  }

  async loadStoredState() {
    try {
      const result = await chrome.storage.local.get([
        "expandedDevices",
        "lastSyncTime",
        "selectedDevice",
      ]);
      if (result.expandedDevices) {
        this.expandedDevices = new Set(result.expandedDevices);
      }
      if (result.lastSyncTime) {
        this.lastSyncTime = result.lastSyncTime;
      }
      if (result.selectedDevice) {
        this.selectedDevice = result.selectedDevice;
      }
    } catch (error) {
      console.error("Error loading stored state:", error);
    }
  }

  async saveState() {
    try {
      await chrome.storage.local.set({
        expandedDevices: Array.from(this.expandedDevices),
        lastSyncTime: this.lastSyncTime,
        selectedDevice: this.selectedDevice,
      });
    } catch (error) {
      console.error("Error saving state:", error);
    }
  }

  async loadDevicesAndTabs() {
    try {
      // Get both remote devices and current device tabs
      const [sessions, currentTabs] = await Promise.all([
        chrome.sessions.getDevices(),
        chrome.tabs.query({}),
      ]);

      this.allDevices.clear();

      // Add remote device sessions
      sessions.forEach((device) => {
        if (device.sessions && device.sessions.length > 0) {
          const tabs = [];
          device.sessions.forEach((session) => {
            if (session.window && session.window.tabs) {
              tabs.push(...session.window.tabs);
            }
          });

          if (tabs.length > 0) {
            // Sort tabs by last accessed time
            tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0));

            this.allDevices.set(device.deviceName, {
              device,
              tabs,
              lastModified: Math.max(
                ...tabs.map((tab) => tab.lastAccessed || 0)
              ),
            });
          }
        }
      });

      // Add current device tabs at the end
      if (currentTabs && currentTabs.length > 0) {
        const currentDeviceTabs = currentTabs.filter(
          (tab) => tab.url && !tab.url.startsWith("chrome://")
        );
        if (currentDeviceTabs.length > 0) {
          this.allDevices.set("This Device", {
            device: { deviceName: "This Device" },
            tabs: currentDeviceTabs.map((tab) => ({
              ...tab,
              lastAccessed: Date.now(), // Current tabs are most recent
            })),
            lastModified: Date.now(),
          });
        }
      }

      // Auto-select device if none selected
      // Always re-evaluate device selection after sync to follow priority
      const previousDevice = this.selectedDevice;
      this.autoSelectDevice();

      // If device changed due to priority, update the header
      if (this.selectedDevice !== previousDevice) {
        this.autoSelectDevice();
        console.log(
          `Device selection changed from "${previousDevice}" to "${this.selectedDevice}" due to priority rules`
        );
      }

      this.updateDeviceHeader();
      this.renderSelectedDeviceTabs();
      this.lastSyncTime = Date.now();
      await this.saveState();
    } catch (error) {
      console.error("Error loading devices and tabs:", error);
      this.showEmptyState();
    }
  }

  autoSelectDevice() {
    const deviceEntries = Array.from(this.allDevices.entries());

    // Priority 1: iPhone if any
    const iPhoneDevice = deviceEntries.find(
      ([name]) =>
        name.toLowerCase().includes("iphone") ||
        name.toLowerCase().includes("ios")
    );

    if (iPhoneDevice) {
      this.selectedDevice = iPhoneDevice[0];
      return;
    }

    // Priority 2: Other remote devices sorted by name
    const remoteDevices = deviceEntries
      .filter(([name]) => name !== "This Device")
      .sort(([nameA], [nameB]) => nameA.localeCompare(nameB));

    if (remoteDevices.length > 0) {
      this.selectedDevice = remoteDevices[0][0];
      return;
    }

    // Priority 3: This Device (fallback)
    if (this.allDevices.has("This Device")) {
      this.selectedDevice = "This Device";
    }
  }

  renderSelectedDeviceTabs() {
    if (!this.selectedDevice || !this.allDevices.has(this.selectedDevice)) {
      this.showEmptyState();
      return;
    }

    this.hideEmptyState();

    const deviceData = this.allDevices.get(this.selectedDevice);
    const { tabs } = deviceData;

    const tabsHTML = tabs
      .map((tab) => this.renderTab(tab, this.selectedDevice))
      .join("");

    this.devicesContainer.innerHTML = tabsHTML;

    // Apply current search filter
    if (this.searchQuery) {
      this.filterTabs(this.searchQuery);
    }
  }

  devicesEqual(devices1, devices2) {
    if (devices1.size !== devices2.size) return false;

    for (const [deviceName, deviceData1] of devices1) {
      const deviceData2 = devices2.get(deviceName);
      if (!deviceData2) return false;

      // Compare tab counts and basic properties
      if (deviceData1.tabs.length !== deviceData2.tabs.length) return false;

      // Compare tab URLs and titles (basic comparison)
      for (let i = 0; i < deviceData1.tabs.length; i++) {
        const tab1 = deviceData1.tabs[i];
        const tab2 = deviceData2.tabs[i];
        if (
          tab1.url !== tab2.url ||
          tab1.title !== tab2.title ||
          tab1.id !== tab2.id
        )
          return false;
      }
    }

    return true;
  }
  updateDeviceCountersOnly(newDevices) {
    // Silently update any changed tab counts without DOM manipulation
    for (const [deviceName, deviceData] of newDevices) {
      const deviceGroup = this.devicesContainer.querySelector(
        `[data-device="${deviceName}"]`
      );
      if (deviceGroup) {
        const statsElement = deviceGroup.querySelector(".device-stats");
        if (statsElement) {
          const currentCount = parseInt(
            statsElement.textContent.match(/\d+/)?.[0] || "0"
          );
          const newCount = deviceData.tabs.length;

          if (currentCount !== newCount) {
            statsElement.textContent = `${newCount} ${
              newCount === 1 ? "tab" : "tabs"
            }`;
          }
        }
      }
    }
  }

  updateDeviceCounters(sortedDevices) {
    sortedDevices.forEach(([deviceName, deviceData]) => {
      const deviceGroup = this.devicesContainer.querySelector(
        `[data-device="${deviceName}"]`
      );
      if (deviceGroup) {
        const statsElement = deviceGroup.querySelector(".device-stats");
        if (statsElement) {
          const tabCount = deviceData.tabs.length;
          statsElement.textContent = `${tabCount} ${
            tabCount === 1 ? "tab" : "tabs"
          }`;
        }

        // Update tabs if device is expanded
        if (this.expandedDevices.has(deviceName)) {
          const tabsContainer = deviceGroup.querySelector(".tabs-container");
          if (tabsContainer) {
            tabsContainer.innerHTML = deviceData.tabs
              .map((tab) => this.renderTab(tab, deviceName))
              .join("");
          }
        }
      }
    });
  }

  arraysEqual(arr1, arr2) {
    if (arr1.length !== arr2.length) return false;
    return arr1.every((val, index) => val === arr2[index]);
  }

  renderTab(tab, deviceName) {
    const favicon = tab.favIconUrl || this.getDefaultFavicon(tab.url);
    const tabId = `${deviceName}-${tab.sessionId || tab.id || Math.random()}`;

    return `
      <div class="tab-item"
           data-url="${this.escapeHtml(tab.url)}" 
           data-title="${this.escapeHtml(tab.title)}"
           data-tab-id="${tabId}"
           tabindex="0">
        <div class="tab-favicon">
          ${this.renderFavicon(favicon)}
        </div>
        <div class="tab-content">
          <div class="tab-title">${this.escapeHtml(tab.title)}</div>
        </div>
      </div>
    `;
  }

  renderFavicon(faviconUrl) {
    return `
      <img src="${faviconUrl}" 
           alt="Favicon" 
           width="16" 
           height="16"
           style="display: block;">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
        <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
        <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
      </svg>
    `;
  }

  setupImageErrorHandling() {
    // Handle favicon loading errors using event delegation
    this.devicesContainer.addEventListener(
      "error",
      (e) => {
        if (e.target.tagName === "IMG" && e.target.closest(".tab-favicon")) {
          e.target.style.display = "none";
          const fallbackSvg = e.target.nextElementSibling;
          if (fallbackSvg) {
            fallbackSvg.style.display = "block";
          }
        }
      },
      true
    );

    this.devicesContainer.addEventListener(
      "load",
      (e) => {
        if (e.target.tagName === "IMG" && e.target.closest(".tab-favicon")) {
          e.target.style.display = "block";
          const fallbackSvg = e.target.nextElementSibling;
          if (fallbackSvg) {
            fallbackSvg.style.display = "none";
          }
        }
      },
      true
    );
  }

  getDeviceIcon(deviceName) {
    const name = deviceName.toLowerCase();
    if (
      name.includes("phone") ||
      name.includes("mobile") ||
      name.includes("android") ||
      name.includes("ios")
    ) {
      return '<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
    } else if (name.includes("tablet") || name.includes("ipad")) {
      return '<rect x="4" y="2" width="16" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
    } else if (name.includes("laptop") || name.includes("macbook")) {
      return '<rect x="2" y="6" width="20" height="12" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>';
    } else {
      return '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
    }
  }

  getDefaultFavicon(url) {
    try {
      const domain = new URL(url).hostname;
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`;
    } catch {
      return "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgc3Ryb2tlPSJjdXJyZW50Q29sb3IiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTEwIDEzYTUgNSAwIDAgMCA3LjU0LjU0bDMtM2E1IDUgMCAwIDAtNy4wNy03LjA3bC0xLjcyIDEuNzEiLz48cGF0aCBkPSJNMTQgMTFhNSA1IDAgMCAwLTcuNTQtLjU0bC0zIDNhNSA1IDAgMCAwIDcuMDcgNy4wN2wxLjcxLTEuNzEiLz48L3N2Zz4=";
    }
  }

  getDomainFromUrl(url) {
    try {
      const urlObj = new URL(url);
      return urlObj.hostname.replace("www.", "");
    } catch {
      return url;
    }
  }

  getTimeAgo(timestamp) {
    if (!timestamp) return "";

    const now = Date.now();
    const diff = now - timestamp;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return "now";
    if (minutes < 60) return `${minutes}m`;
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;
    return `${Math.floor(days / 7)}w`;
  }

  async toggleDevice(deviceName) {
    if (this.expandedDevices.has(deviceName)) {
      this.expandedDevices.delete(deviceName);
    } else {
      this.expandedDevices.add(deviceName);
    }

    const deviceGroup = document.querySelector(`[data-device="${deviceName}"]`);
    if (deviceGroup) {
      deviceGroup.classList.toggle("expanded");
    }

    await this.saveState();
  }

  async openTab(url) {
    try {
      await chrome.tabs.create({ url, active: true });
    } catch (error) {
      console.error("Error opening tab:", error);
    }
  }

  filterTabs(query) {
    const lowerQuery = query.toLowerCase();
    const tabItems = document.querySelectorAll(".tab-item");

    // Filter tabs
    tabItems.forEach((item) => {
      const title = item.dataset.title.toLowerCase();
      const url = item.dataset.url.toLowerCase();

      const matches = title.includes(lowerQuery) || url.includes(lowerQuery);
      item.style.display = matches ? "flex" : "none";
    });
  }

  showEmptyState() {
    this.devicesContainer.innerHTML = "";
    this.emptyState.style.display = "flex";
  }

  hideEmptyState() {
    this.emptyState.style.display = "none";
  }

  setupAutoRefresh() {
    // Refresh every 60 seconds
    setInterval(() => {
      // Only auto-refresh if the sidebar is visible and focused
      if (document.visibilityState === "visible") {
        this.loadDevicesAndTabs();
      }
    }, 60000);
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text || "";
    return div.innerHTML;
  }
}

// Initialize the sidebar when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  window.sidebar = new DeviceTabsSidebar();
});
