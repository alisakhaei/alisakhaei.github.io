const projects = {
  forklift: {
    type: "Mechanical Design",
    title: "Forklift Crane Attachment",
    description: "A removable and manually adjustable crane attachment developed for a 3-ton forklift. The work includes stability checks, static loading, bolts, pins, welds, structural members, manufacturing drawings, and a complete SolidWorks assembly. This is an academic design and has not been fabricated or certified for lifting operations.",
    tags: ["SolidWorks", "Machine Design", "Structural Analysis", "Engineering Drawings"],
    link: "https://github.com/alisakhaei/forklift-crane-attachment"
  },
  motor: {
    type: "Control & Simulation",
    title: "DC Motor Speed Control",
    description: "Modeling and simulation of a separately excited DC motor. The repository compares open-loop behavior with closed-loop speed regulation using a PI controller and armature-voltage saturation in MATLAB/Simulink.",
    tags: ["MATLAB", "Simulink", "Dynamic Modeling", "PI Control"],
    link: "https://github.com/alisakhaei/dc-motor-speed-control"
  },
  gearbox: {
    type: "Machine Design",
    title: "Two-Stage Gearbox",
    description: "Mechanical design and analysis of a two-stage gearbox, covering gears, shafts, bearings, housing, component selection, engineering calculations, and the final SolidWorks assembly.",
    tags: ["SolidWorks", "Gear Design", "Shaft Design", "Bearings"],
    link: "https://github.com/alisakhaei/gearbox-design"
  },
  pump: {
    type: "Multibody Dynamics",
    title: "Reciprocating Pump Dynamics",
    description: "A Simscape Multibody model of a reciprocating pump mechanism. The study compares operation at 100 and 300 rpm and examines how adding a flywheel changes torque and system response.",
    tags: ["MATLAB", "Simscape Multibody", "Dynamics", "Flywheel"],
    link: "https://github.com/alisakhaei/reciprocating-pump-dynamics"
  },
  pinn: {
    type: "Computational Methods",
    title: "Airfoil Flow with PINNs",
    description: "A computational study of two-dimensional airfoil flow using potential-flow methods and physics-informed neural networks. The repository includes Python notebooks, trained models, MATLAB scripts, datasets, and flow-field results.",
    tags: ["Python", "PyTorch", "PINN", "Potential Flow"],
    link: "https://github.com/alisakhaei/airfoil-flow-pinn"
  },
  fluent: {
    type: "CFD",
    title: "ANSYS Fluent Flow Analysis",
    description: "A collection of CFD studies covering diffuser flow, pressure loss in pipe elbows, and compressible nozzle flow. MATLAB scripts are used for additional data processing and result visualization.",
    tags: ["ANSYS Fluent", "MATLAB", "CFD", "Post-processing"],
    link: "https://github.com/alisakhaei/ansys-fluent-flow-analysis"
  }
};

const menuButton = document.querySelector(".menu-button");
const navigation = document.querySelector(".site-nav");
menuButton.addEventListener("click", () => {
  const expanded = menuButton.getAttribute("aria-expanded") === "true";
  menuButton.setAttribute("aria-expanded", String(!expanded));
  navigation.classList.toggle("open", !expanded);
});
navigation.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => {
  navigation.classList.remove("open");
  menuButton.setAttribute("aria-expanded", "false");
}));

const dialog = document.querySelector("#project-dialog");
const dialogType = document.querySelector("#dialog-type");
const dialogTitle = document.querySelector("#dialog-title");
const dialogDescription = document.querySelector("#dialog-description");
const dialogTags = document.querySelector("#dialog-tags");
const dialogLink = document.querySelector("#dialog-link");

document.querySelectorAll(".project-open").forEach((button) => {
  button.addEventListener("click", () => {
    const project = projects[button.dataset.project];
    dialogType.textContent = project.type;
    dialogTitle.textContent = project.title;
    dialogDescription.textContent = project.description;
    dialogTags.replaceChildren(...project.tags.map((tag) => {
      const element = document.createElement("span");
      element.textContent = tag;
      return element;
    }));
    dialogLink.href = project.link;
    dialog.showModal();
  });
});

document.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.querySelector("#year").textContent = new Date().getFullYear();
