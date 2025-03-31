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

// Copy YAML to clipboard
document.getElementById("copyBtn").addEventListener("click", () => {
  const text = document.getElementById("secretOutput").textContent;
  navigator.clipboard.writeText(text).then(() => {
    alert("YAML copied to clipboard!");
  });
});

// Download YAML as file
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
