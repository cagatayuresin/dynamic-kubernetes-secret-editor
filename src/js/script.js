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
    } catch (e) {
      console.error("Failed to parse saved secret object.");
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

    const reader = new FileReader();
    reader.onload = function (e) {
      try {
        const content = e.target.result;
        const parsed = jsyaml.load(content);

        if (parsed.kind === "Secret" && parsed.apiVersion?.startsWith("v1")) {
          try {
            validateKubernetesSecret(parsed);
            currentSecretObj = parsed;
            updateYamlOutput();
            renderDecodedFields();
            showNotification("Secret loaded successfully!", "success");
          } catch (validationError) {
            showNotification(validationError.message, "warning");
          }
        } else {
          showNotification("This YAML is not a valid Kubernetes Secret.", "warning");
        }
      } catch (err) {
        console.error("YAML parsing error:", err);
        showNotification(`Failed to parse YAML: ${err.message}`, "danger");
      }
    };

    reader.readAsText(file);
  });

// Copy YAML to clipboard
document.getElementById("copyBtn").addEventListener("click", () => {
  const text = document.getElementById("secretOutput").textContent;
  navigator.clipboard.writeText(text).then(() => {
    showNotification("YAML copied to clipboard!", "success");
  }).catch(() => {
    showNotification("Failed to copy to clipboard", "error");
  });
});

// Download YAML as file
document.getElementById("downloadBtn").addEventListener("click", () => {
  const yamlText = document.getElementById("secretOutput").textContent;
  const blob = new Blob([yamlText], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  
  // Generate filename with timestamp
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const secretName = currentSecretObj?.metadata?.name || 'secret';
  link.download = `${secretName}-${timestamp}.yaml`;
  
  link.click();
  URL.revokeObjectURL(url);
  showNotification("YAML downloaded successfully!", "success");
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

// Notification system
function showNotification(message, type = 'info') {
  // Remove existing notifications
  const existingNotifications = document.querySelectorAll('.notification-toast');
  existingNotifications.forEach(n => n.remove());

  const notification = document.createElement('div');
  notification.className = `notification is-${type} notification-toast`;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 1000;
    min-width: 300px;
    animation: slideIn 0.3s ease-out;
  `;
  
  notification.innerHTML = `
    <button class="delete" onclick="this.parentElement.remove()"></button>
    ${message}
  `;
  
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }
  }, 3000);
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
  if (confirm("Are you sure you want to clear all stored data? This action cannot be undone.")) {
    localStorage.removeItem('yamlContent');
    localStorage.removeItem('secretObject');
    currentSecretObj = null;
    document.getElementById("secretOutput").textContent = "";
    document.getElementById("dataInputs").innerHTML = "";
    document.getElementById("yamlInput").value = "";
    showNotification("All data cleared successfully!", "info");
  }
});

// Export configuration
document.getElementById("exportConfigBtn").addEventListener("click", () => {
  const config = {
    timestamp: new Date().toISOString(),
    theme: localStorage.getItem("theme") || "light",
    hasSecret: !!currentSecretObj,
    secretName: currentSecretObj?.metadata?.name || null
  };
  
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `k8s-secret-editor-config-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  showNotification("Configuration exported!", "success");
});
