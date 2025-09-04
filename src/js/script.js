let currentSecretObj = null;

// Restore state from localStorage
window.addEventListener("DOMContentLoaded", () => {
  const savedYaml = localStorage.getItem("yamlContent");
  const savedSecret = localStorage.getItem("secretObject");
  const theme = localStorage.getItem("theme");

  if (theme === "dark") {
    applyTheme("dark");
  }

  if (savedSecret) {
    try {
      currentSecretObj = JSON.parse(savedSecret);
      updateYamlOutput();
      renderDecodedFields();
      
      // Show restore notification after a brief delay
      setTimeout(() => {
        const secretName = currentSecretObj?.metadata?.name || 'Unnamed Secret';
        showNotification(`🔄 Restored: ${secretName}`, "info", 3000);
      }, 1000);
    } catch (e) {
      console.error("Failed to parse saved secret object.");
      showNotification("⚠️ Failed to restore previous session", "warning");
    }
  }

  if (savedYaml) {
    document.getElementById("secretOutput").textContent = savedYaml;
    hljs.highlightElement(document.getElementById("secretOutput"));
  }

  // Show floating buttons always
  document.querySelectorAll("#floatingButtons button").forEach((btn) => {
    btn.classList.add("active");
  });
});

// Update YAML preview
function updateYamlOutput() {
  if (!currentSecretObj) return;

  const yamlOutput = jsyaml.dump(currentSecretObj, {
    lineWidth: -1, // Prevent folded format (e.g., >-)
  });

  const outputEl = document.getElementById("secretOutput");
  outputEl.textContent = yamlOutput;
  hljs.highlightElement(outputEl);

  localStorage.setItem("yamlContent", yamlOutput);
  localStorage.setItem("secretObject", JSON.stringify(currentSecretObj));
}

// Render decoded base64 fields as inputs
function renderDecodedFields() {
  const container = document.getElementById("dataInputs");
  container.innerHTML = "";

  Object.entries(currentSecretObj.data || {}).forEach(([key, base64Val]) => {
    const decoded = atob(base64Val);

    const field = document.createElement("div");
    field.className = "field";

    const label = document.createElement("label");
    label.className = "label";
    label.textContent = key;

    const input = document.createElement("input");
    input.className = "input";
    input.type = "text";
    input.value = decoded;
    input.dataset.key = key;

    input.addEventListener("input", () => {
      const encoded = btoa(input.value);
      currentSecretObj.data[key] = encoded;
      updateYamlOutput();
    });

    field.appendChild(label);
    field.appendChild(input);
    container.appendChild(field);
  });
}

// YAML file upload handler
document
  .getElementById("yamlInput")
  .addEventListener("change", function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const loadingNotification = showLoadingNotification("Processing YAML file...");

    const reader = new FileReader();
    reader.onload = function (e) {
      const content = e.target.result;
      processYamlContent(content, "file");
      hideLoadingNotification();
    };

    reader.readAsText(file);
  });

// YAML paste functionality
document.getElementById("processYamlBtn").addEventListener("click", () => {
  const yamlContent = document.getElementById("yamlTextarea").value.trim();
  
  if (!yamlContent) {
    showNotification("⚠️ Please paste some YAML content first", "warning");
    return;
  }
  
  const loadingNotification = showLoadingNotification("Processing pasted YAML...");
  
  // Add small delay for better UX
  setTimeout(() => {
    processYamlContent(yamlContent, "paste");
    hideLoadingNotification();
  }, 500);
});

// Clear YAML textarea
document.getElementById("clearYamlBtn").addEventListener("click", () => {
  document.getElementById("yamlTextarea").value = "";
  showNotification("📝 YAML content cleared", "info", 2000);
});

// Keyboard shortcuts for YAML textarea
document.getElementById("yamlTextarea").addEventListener("keydown", (e) => {
  // Ctrl+Enter or Cmd+Enter to process
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    document.getElementById("processYamlBtn").click();
  }
  
  // Ctrl+Shift+C or Cmd+Shift+C to clear
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "C") {
    e.preventDefault();
    document.getElementById("clearYamlBtn").click();
  }
  
  // Tab support for better YAML editing
  if (e.key === "Tab") {
    e.preventDefault();
    const start = e.target.selectionStart;
    const end = e.target.selectionEnd;
    
    // Insert 2 spaces (YAML standard)
    e.target.value = e.target.value.substring(0, start) + "  " + e.target.value.substring(end);
    e.target.selectionStart = e.target.selectionEnd = start + 2;
  }
});

// Auto-resize textarea based on content
document.getElementById("yamlTextarea").addEventListener("input", (e) => {
  const textarea = e.target;
  textarea.style.height = "auto";
  textarea.style.height = Math.max(150, textarea.scrollHeight) + "px";
});

// Unified YAML processing function
function processYamlContent(content, source = "unknown") {
  try {
    const parsed = jsyaml.load(content);

    if (parsed.kind === "Secret" && parsed.apiVersion?.startsWith("v1")) {
      try {
        validateKubernetesSecret(parsed);
        currentSecretObj = parsed;
        updateYamlOutput();
        renderDecodedFields();
        
        // Clear the textarea after successful processing
        if (source === "paste") {
          document.getElementById("yamlTextarea").value = "";
        }
        
        const sourceText = source === "file" ? "uploaded" : "pasted";
        showNotification(`✅ Secret "${parsed.metadata?.name || 'Unnamed'}" ${sourceText} successfully!`, "success");
      } catch (validationError) {
        showNotification(`⚠️ ${validationError.message}`, "warning");
      }
    } else {
      showNotification("⚠️ This YAML is not a valid Kubernetes Secret.", "warning");
    }
  } catch (err) {
    console.error("YAML parsing error:", err);
    showNotification(`❌ Failed to parse YAML: ${err.message}`, "danger");
  }
}

// Copy YAML to clipboard
document.getElementById("copyBtn").addEventListener("click", async () => {
  const text = document.getElementById("secretOutput").textContent;
  
  if (!text.trim()) {
    showNotification("⚠️ No YAML content to copy", "warning");
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showNotification("📋 YAML copied to clipboard!", "success", 2000);
  } catch (err) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showNotification("📋 YAML copied to clipboard!", "success", 2000);
    } catch (fallbackErr) {
      showNotification("❌ Failed to copy to clipboard", "danger");
    }
    document.body.removeChild(textArea);
  }
});

// Download YAML as file
document.getElementById("downloadBtn").addEventListener("click", () => {
  const yamlText = document.getElementById("secretOutput").textContent;
  
  if (!yamlText.trim()) {
    showNotification("⚠️ No YAML content to download", "warning");
    return;
  }

  const loadingNotification = showLoadingNotification("Preparing download...");
  
  setTimeout(() => {
    try {
      const blob = new Blob([yamlText], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
      const secretName = currentSecretObj?.metadata?.name || 'secret';
      const filename = `${secretName}-${timestamp}.yaml`;
      link.download = filename;
      
      link.click();
      URL.revokeObjectURL(url);
      hideLoadingNotification();
      showNotification(`📥 Downloaded: ${filename}`, "success");
    } catch (err) {
      hideLoadingNotification();
      showNotification("❌ Failed to download file", "danger");
    }
  }, 500);
});

// Dark/light theme toggle
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
const themeIcon = document.getElementById("themeIcon");

function setLogo() {
  const imagePlaceholder = document.getElementById("imagePlaceholder");

  const imgElement = document.createElement("img");
  imgElement.id = "logo";
  imgElement.src =
    localStorage.getItem("theme") === "dark"
      ? "src/img/cagatayuresin-logo-w.png"
      : "src/img/cagatayuresin-logo.png";
  imgElement.alt = "Logo";
  imgElement.style.maxWidth = "60px";

  imagePlaceholder.appendChild(imgElement);
}

function applyTheme(mode) {
  const imgElement = document.getElementById("logo");
  const yamlTheme = document.getElementById("yamlTheme");
  if (mode === "dark") {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    themeIcon.className = "ti ti-sun";
    localStorage.setItem("theme", "dark");
    imgElement.src = "src/img/cagatayuresin-logo-w.png";
    yamlTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/nnfx-dark.min.css";
  } else {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    themeIcon.className = "ti ti-moon";
    localStorage.setItem("theme", "light");
    imgElement.src = "src/img/cagatayuresin-logo.png";
    yamlTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/nnfx-light.min.css";
  }
}

toggleThemeBtn.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(isDark ? "light" : "dark");
});

// Back to top functionality
const backToTopBtn = document.getElementById("backToTopBtn");
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

setLogo(); // Set the logo on page load

// Enhanced notification system
function showNotification(message, type = 'info', duration = 4000) {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(n => n.remove());

  // Icon mapping for different types
  const iconMap = {
    'success': 'ti-check-circle',
    'info': 'ti-info-circle',
    'warning': 'ti-alert-triangle',
    'danger': 'ti-alert-circle'
  };

  const notification = document.createElement('div');
  notification.className = `notification is-${type} notification-toast`;
  
  notification.innerHTML = `
    <button class="delete" onclick="this.parentElement.remove()"></button>
    <div style="display: flex; align-items: center;">
      <i class="ti ${iconMap[type] || 'ti-info-circle'}"></i>
      <span>${message}</span>
    </div>
    <div class="notification-progress"></div>
  `;
  
  document.body.appendChild(notification);
  
  // Add entrance animation
  setTimeout(() => {
    notification.style.animation = 'fadeInUp 0.3s ease-out';
  }, 10);
  
  // Auto remove with exit animation
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }
  }, duration);
  
  // Add click to dismiss
  notification.addEventListener('click', () => {
    notification.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => notification.remove(), 300);
  });
}

// Multi-notification support
let notificationQueue = [];
let isShowingNotification = false;

function queueNotification(message, type = 'info', duration = 4000) {
  notificationQueue.push({ message, type, duration });
  processNotificationQueue();
}

function processNotificationQueue() {
  if (isShowingNotification || notificationQueue.length === 0) return;
  
  isShowingNotification = true;
  const { message, type, duration } = notificationQueue.shift();
  
  showNotification(message, type, duration);
  
  setTimeout(() => {
    isShowingNotification = false;
    processNotificationQueue();
  }, duration + 500);
}

// Loading notification helper
function showLoadingNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification is-info notification-toast notification-loading';
  notification.id = 'loading-notification';
  
  notification.innerHTML = `
    <div style="display: flex; align-items: center;">
      <div class="is-loading" style="margin-right: 10px; width: 20px; height: 20px;"></div>
      <span>${message}</span>
    </div>
  `;
  
  document.body.appendChild(notification);
  return notification;
}

function hideLoadingNotification() {
  const loading = document.getElementById('loading-notification');
  if (loading) {
    loading.style.animation = 'slideOutRight 0.3s ease-in';
    setTimeout(() => loading.remove(), 300);
  }
}

// Add validation for secret uploads
function validateKubernetesSecret(parsed) {
  if (!parsed) {
    throw new Error('Invalid YAML content');
  }
  
  if (parsed.kind !== 'Secret') {
    throw new Error('YAML must be a Kubernetes Secret (kind: Secret)');
  }
  
  if (!parsed.apiVersion || !parsed.apiVersion.includes('v1')) {
    throw new Error('Secret must use apiVersion v1');
  }
  
  if (!parsed.metadata || !parsed.metadata.name) {
    throw new Error('Secret must have metadata.name');
  }
  
  if (!parsed.data && !parsed.stringData) {
    throw new Error('Secret must have either data or stringData');
  }
  
  return true;
}

// Add CSS for notifications
const notificationCSS = `
@keyframes slideIn {
  from { transform: translateX(100%); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}

@keyframes slideOut {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(100%); opacity: 0; }
}

.notification-toast {
  animation: slideIn 0.3s ease-out;
}
`;

const style = document.createElement('style');
style.textContent = notificationCSS;
document.head.appendChild(style);

// Clear all data functionality
document.getElementById("clearDataBtn").addEventListener("click", () => {
  // Create custom confirmation dialog
  const confirmDialog = document.createElement('div');
  confirmDialog.className = 'notification is-warning notification-toast';
  confirmDialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    z-index: 1001;
    min-width: 400px;
  `;
  
  confirmDialog.innerHTML = `
    <div style="text-align: center;">
      <i class="ti ti-alert-triangle" style="font-size: 2rem; display: block; margin-bottom: 10px;"></i>
      <strong>Clear All Data?</strong>
      <p style="margin: 10px 0;">This will permanently delete all stored data. This action cannot be undone.</p>
      <div style="margin-top: 15px;">
        <button class="button is-danger" id="confirmClear">
          <span class="icon"><i class="ti ti-trash"></i></span>
          <span>Yes, Clear All</span>
        </button>
        <button class="button is-light" id="cancelClear" style="margin-left: 10px;">
          <span>Cancel</span>
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(confirmDialog);
  
  document.getElementById('confirmClear').addEventListener('click', () => {
    localStorage.removeItem('yamlContent');
    localStorage.removeItem('secretObject');
    currentSecretObj = null;
    document.getElementById("secretOutput").textContent = "";
    document.getElementById("dataInputs").innerHTML = "";
    document.getElementById("yamlInput").value = "";
    confirmDialog.remove();
    showNotification("🗑️ All data cleared successfully!", "info");
  });
  
  document.getElementById('cancelClear').addEventListener('click', () => {
    confirmDialog.remove();
  });
});

// Export configuration
document.getElementById("exportConfigBtn").addEventListener("click", () => {
  const loadingNotification = showLoadingNotification("Generating configuration...");
  
  setTimeout(() => {
    try {
      const config = {
        timestamp: new Date().toISOString(),
        theme: localStorage.getItem("theme") || "light",
        hasSecret: !!currentSecretObj,
        secretName: currentSecretObj?.metadata?.name || null,
        secretNamespace: currentSecretObj?.metadata?.namespace || null,
        secretType: currentSecretObj?.type || null,
        dataKeys: currentSecretObj?.data ? Object.keys(currentSecretObj.data) : [],
        version: "1.0.0",
        generator: "Dynamic Kubernetes Secret Editor"
      };
      
      const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `k8s-secret-editor-config-${timestamp}.json`;
      link.download = filename;
      
      link.click();
      URL.revokeObjectURL(url);
      hideLoadingNotification();
      showNotification(`📤 Configuration exported: ${filename}`, "success");
    } catch (err) {
      hideLoadingNotification();
      showNotification("❌ Failed to export configuration", "danger");
    }
  }, 800);
});
