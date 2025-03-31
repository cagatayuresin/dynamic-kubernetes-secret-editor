/**
 * Dynamic Kubernetes Secret Editor
 * This script provides functionality to decode, edit, and manage Kubernetes secrets.
 * It includes features such as YAML file upload, Base64 decoding, YAML preview, 
 * theme toggling, and saving/restoring state using localStorage.
 */

let currentSecretObj = null; // Stores the current Kubernetes Secret object

// Restore state from localStorage when the page loads
window.addEventListener("DOMContentLoaded", () => {
  const savedYaml = localStorage.getItem("yamlContent"); // Retrieve saved YAML content
  const savedSecret = localStorage.getItem("secretObject"); // Retrieve saved secret object
  const theme = localStorage.getItem("theme"); // Retrieve saved theme preference

  // Apply the saved theme (dark or light)
  if (theme === "dark") {
    applyTheme("dark");
  }

  // Restore the secret object and update the UI
  if (savedSecret) {
    try {
      currentSecretObj = JSON.parse(savedSecret);
      updateYamlOutput();
      renderDecodedFields();
    } catch (e) {
      console.error("Failed to parse saved secret object.");
    }
  }

  // Restore the YAML preview
  if (savedYaml) {
    document.getElementById("secretOutput").textContent = savedYaml;
    hljs.highlightElement(document.getElementById("secretOutput"));
  }

  // Ensure floating buttons are always visible
  document.querySelectorAll("#floatingButtons button").forEach((btn) => {
    btn.classList.add("active");
  });
});

/**
 * Updates the YAML preview in the UI and saves it to localStorage.
 */
function updateYamlOutput() {
  if (!currentSecretObj) return;

  // Convert the secret object to YAML format
  const yamlOutput = jsyaml.dump(currentSecretObj, {
    lineWidth: -1, // Prevent folded format (e.g., >-)
  });

  // Update the YAML preview element
  const outputEl = document.getElementById("secretOutput");
  outputEl.textContent = yamlOutput;
  hljs.highlightElement(outputEl);

  // Save the YAML content and secret object to localStorage
  localStorage.setItem("yamlContent", yamlOutput);
  localStorage.setItem("secretObject", JSON.stringify(currentSecretObj));
}

/**
 * Renders decoded Base64 fields as editable input fields in the UI.
 */
function renderDecodedFields() {
  const container = document.getElementById("dataInputs");
  container.innerHTML = ""; // Clear existing fields

  // Iterate over each key-value pair in the secret data
  Object.entries(currentSecretObj.data || {}).forEach(([key, base64Val]) => {
    const decoded = atob(base64Val); // Decode the Base64 value

    // Create a field for the decoded value
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

    // Update the secret object when the input value changes
    input.addEventListener("input", () => {
      const encoded = btoa(input.value); // Encode the value back to Base64
      currentSecretObj.data[key] = encoded;
      updateYamlOutput();
    });

    field.appendChild(label);
    field.appendChild(input);
    container.appendChild(field);
  });
}

// Handle YAML file upload
document.getElementById("yamlInput").addEventListener("change", function (event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      const content = e.target.result;
      const parsed = jsyaml.load(content);

      // Validate if the uploaded file is a Kubernetes Secret
      if (parsed.kind === "Secret" && parsed.apiVersion?.startsWith("v1")) {
        currentSecretObj = parsed;
        updateYamlOutput();
        renderDecodedFields();
      } else {
        alert("This YAML is not a valid Kubernetes Secret.");
      }
    } catch (err) {
      alert("Failed to parse YAML.");
    }
  };

  reader.readAsText(file);
});

// Copy YAML content to clipboard
document.getElementById("copyBtn").addEventListener("click", () => {
  const text = document.getElementById("secretOutput").textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert("YAML copied to clipboard!");
  });
});

// Download YAML content as a file
document.getElementById("downloadBtn").addEventListener("click", () => {
  const yamlText = document.getElementById("secretOutput").textContent;
  const blob = new Blob([yamlText], { type: "text/yaml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "secret.yaml";
  link.click();
  alert("YAML downloaded!");
});

// Toggle between dark and light themes
const toggleThemeBtn = document.getElementById("toggleThemeBtn");
const themeIcon = document.getElementById("themeIcon");

/**
 * Sets the logo based on the current theme.
 */
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

/**
 * Applies the selected theme (dark or light) to the UI.
 * @param {string} mode - The theme mode ("dark" or "light").
 */
function applyTheme(mode) {
  const imgElement = document.getElementById("logo");
  const yamlTheme = document.getElementById("yamlTheme");
  if (mode === "dark") {
    document.body.classList.add("dark-mode");
    document.body.classList.remove("light-mode");
    themeIcon.className = "fas fa-sun";
    localStorage.setItem("theme", "dark");
    imgElement.src = "src/img/cagatayuresin-logo-w.png";
    yamlTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/nnfx-dark.min.css";
  } else {
    document.body.classList.remove("dark-mode");
    document.body.classList.add("light-mode");
    themeIcon.className = "fas fa-moon";
    localStorage.setItem("theme", "light");
    imgElement.src = "src/img/cagatayuresin-logo.png";
    yamlTheme.href = "https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.7.0/styles/nnfx-light.min.css";
  }
}

// Toggle theme on button click
toggleThemeBtn.addEventListener("click", () => {
  const isDark = document.body.classList.contains("dark-mode");
  applyTheme(isDark ? "light" : "dark");
});

// Scroll back to the top of the page
const backToTopBtn = document.getElementById("backToTopBtn");
backToTopBtn.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// Initialize the logo on page load
setLogo();