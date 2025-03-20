// Last Edited By Brighton Sibanda

import { GRID_X_RANGE, GRID_Z_RANGE, GRID_Y_OFFSET, FLOAT_SIZE, CAMERA_SPEED, CAMERA_ROT_SPEED } from "./extras.js"
import { buildGridMesh, createPowerOfTwoTexture, buildCubeMesh } from "./utils.js"

// ACKNOWLEDGEMENTS
//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// CS 351 Assignment 8 Solution --> sequence for adding textures, and adding a white ligt 
// CS 351 Assignment 9 --> lighting
// CS 351 Assignment 8 --> a8.vert, a8.frag
// GenAI - debugging power of 2 txture image function (errors loading)
// Spherical cordinte system formulas --> https://en.wikipedia.org/wiki/Spherical_coordinate_system
// C++ Unrolling loop (debugging fragment shader) --> https://www.geeksforgeeks.org/loop-unrolling/
//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// references to the GLSL programs we need to load
var g_vshader, g_fshader

// references to general information
var g_canvas, gl, g_lastFrameMS

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref
var g_u_inversetranspose_ref
var g_u_light_ref
var g_u_specpower_ref
var g_u_flatlighting_ref
var g_u_flatcolor_ref
var g_u_texture_ref

// Point light uniforms
var g_u_point_lights_ref
var g_u_point_light_count_ref

// usual model/world matrices --> start with cottage
var g_cottageMatrix
var g_worldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at the teapot
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// the current axis of rotation (I may not use this)
var g_rotationAxis

// Grid definitions
var g_gridMesh
var g_gridNormals
var g_gridTexCoords

// Texture images
var g_cottageImage
var g_gridImage
var g_cloudImage
var g_cottageTexturePointer
var g_gridTexturePointer
var g_cloudTexturePointer // for my one cloud

// Light position
var g_lightPosition

// Spec Power
var g_specPower

// Key states - properly initialized to false
var g_movingUp = false
var g_movingDown = false
var g_movingLeft = false
var g_movingRight = false
var g_movingForward = false
var g_movingBackward = false

var g_cloudMeshes = [] 
var g_cloudMatrices = []
var g_cloudTexCoords = []
var g_cloudNormals = []

// Cottage mesh data
var g_cottageMesh = []
var g_cottageNormals = []
var g_cottageTexCoords = []

// Cube mesh for light source
var g_cubeMesh

// Star variables
var g_starPositions = []
var g_starColors = []
var g_starCount = 2000
var g_starSize = 0.05

// Firefly system variables
var g_fireflies = []
var g_fireflyCount = 50 
var g_fireflyColors = [
  [1.0, 0.9, 0.4], // Warm yellow
  [1.0, 0.8, 0.3], // Golden yellow
  [0.9, 0.8, 0.2], // Amber
]
var g_fireflySize = 0.03
var g_fireflyIntensity = 0.8
var g_fireflyLights = []

// For disabling my white light
var g_lightEnabled = false

// Container variables
var g_containerMesh = []
var g_containerNormals = []
var g_containerTexCoords = []
var g_containerImage
var g_containerImage2 // Second texture for the second container
var g_containerTexturePointer
var g_containerTexturePointer2 // Second texture pointer
var g_containerMatrix
var g_containerMatrix2
var g_containerLoaded = false // Flag to track if container loaded successfully

// Extra cottage variables
var g_extraCottageMesh = []
var g_extraCottageNormals = []
var g_extraCottageTexCoords = []
var g_extraCottageImage
var g_extraCottageTexturePointer
var g_extraCottageMatrix
var g_extraCottageLoaded = false

// Spaceship variables
var g_spaceshipMesh = []
var g_spaceshipNormals = []
var g_spaceshipTexCoords = []
var g_spaceshipImage
var g_spaceshipTexturePointer
var g_spaceshipMatrix
var g_spaceshipLoaded = false
var g_spaceshipRotation = 0 // For animation
var g_spaceshipLaunched = false // Track if spaceship is launched
var g_launchTime = 0 // When the launch started
var g_launchSpeed = 0.05 // Speed of launch

///// extras
var slider_input
var label
var camX, camY, camZ, angle, cameraMatrix

function main() {
  // Setup our sliders
  slider_input = document.getElementById("sliderX")
  slider_input.addEventListener("input", (event) => {
    updateLightX(event.target.value)
  })
  slider_input = document.getElementById("sliderY")
  slider_input.addEventListener("input", (event) => {
    updateLightY(event.target.value)
  })
  slider_input = document.getElementById("sliderZ")
  slider_input.addEventListener("input", (event) => {
    updateLightZ(event.target.value)
  })
  slider_input = document.getElementById("sliderPower")
  slider_input.addEventListener("input", (event) => {
    updateSpecPower(event.target.value)
  })

  // Setup key presses and releases
  setupKeyBinds()

  g_canvas = document.getElementById("canvas")

  // Get the rendering context for WebGL
  gl = getWebGLContext(g_canvas, true)
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL")
    return
  }

  // We will call this at the end of most main functions from now on
  loadImageFiles()

  // enabling the light
  const lightToggle = document.getElementById("toggleLight")
  lightToggle.addEventListener("change", (event) => {
    g_lightEnabled = event.target.checked
  })

  // Launching the spacecraft event listener
  const launchButton = document.getElementById("launchButton")
  launchButton.addEventListener("click", () => {
    if (g_spaceshipLoaded && !g_spaceshipLaunched) {
      g_spaceshipLaunched = true
      g_launchTime = Date.now()
      console.log("Launching spaceship!")
    }
  })
}

async function loadImageFiles() {
  g_cottageImage = new Image()
  g_cottageImage.src = "./resources/85-cottage_obj/cottage_diffuse_upside_down.png"
  await g_cottageImage.decode()

  // Grid texture
  const tempImage = new Image()
  tempImage.src = "./resources/mountain/ground_grass_3264_4062_Small.jpg"
  tempImage.crossOrigin = "anonymous"
  await tempImage.decode()

  // Convert to power-of-two texture (avoiding errors)
  g_gridImage = createPowerOfTwoTexture(tempImage)

  // Load the cloud texture
  const cloudTempImage = new Image()
  cloudTempImage.src = "./resources/clouds/cloud_unsplash.jpg"
  cloudTempImage.crossOrigin = "anonymous"
  await cloudTempImage.decode()

  // Convert to power-of-two texture
  g_cloudImage = createPowerOfTwoTexture(cloudTempImage)

  // Load container textures
  try {
    console.log("Loading container textures...")

    // First container texture - DiffuseMap
    g_containerImage = new Image()
    g_containerImage.crossOrigin = "anonymous"
    g_containerImage.src = "./resources/container/textures/Container_DiffuseMap.jpg"
    await g_containerImage.decode()
    console.log("Container texture 1 loaded successfully")

    // Second container texture - using specular map
    g_containerImage2 = new Image()
    g_containerImage2.crossOrigin = "anonymous"
    g_containerImage2.src = "./resources/container/textures/Container_SpecularMap.jpg"
    await g_containerImage2.decode()
    console.log("Container texture 2 loaded successfully")
  } catch (error) {
    console.error("Error loading container textures:", error)
  }

  // Load extra cottage texture
  try {
    console.log("Loading extra cottage texture...")
    g_extraCottageImage = new Image()
    g_extraCottageImage.crossOrigin = "anonymous"
    g_extraCottageImage.src = "./resources/ExtraCottage/textures/Cottage_Dirt_Base_Color.png"
    await g_extraCottageImage.decode()
    console.log("Extra cottage texture loaded successfully")
  } catch (error) {
    console.error("Error loading extra cottage texture:", error)
  }

  // Load spaceship texture
  try {
    console.log("Loading spaceship texture...")
    g_spaceshipImage = new Image()
    g_spaceshipImage.crossOrigin = "anonymous"
    g_spaceshipImage.src = "./resources/spaceship/Andorian (3).png"
    await g_spaceshipImage.decode()
    console.log("Spaceship texture loaded successfully")
  } catch (error) {
    console.error("Error loading spaceship texture:", error)
  }

  loadGLSLFiles()
}

async function loadGLSLFiles() {
  g_vshader = await fetch("./main.vert")
    .then((response) => response.text())
    .then((x) => x)
  g_fshader = await fetch("./main.frag")
    .then((response) => response.text())
    .then((x) => x)

  // wait until everything is loaded before rendering
  loadOBJFiles()
}

// Load OBJFiles
async function loadOBJFiles() {
  // Load the cottage model
  const cottageData = await fetch("./resources/85-cottage_obj/cottage_tri.obj").then((response) => response.text())

  // Parse the cottage OBJ file to get mesh, normals, and texture coordinates
  g_cottageMesh = []
  g_cottageNormals = []
  g_cottageTexCoords = []
  readObjFile(cottageData, g_cottageMesh, g_cottageNormals, g_cottageTexCoords)

  // Load the container model
  try {
    console.log("Loading container model...")
    const containerData = await fetch("./resources/container/Container.obj").then((response) => response.text())

    // Clear arrays
    g_containerMesh = []
    g_containerNormals = []
    g_containerTexCoords = []

    // Read my file
    readObjFile(containerData, g_containerMesh, g_containerNormals, g_containerTexCoords)

    // Check if we got valid data
    if (g_containerMesh.length > 0) {
      g_containerLoaded = true
      console.log("Container model loaded successfully with", g_containerMesh.length / 3, "triangles")
      console.log("Container normals:", g_containerNormals.length / 3, "vertices")
      console.log("Container texture coordinates:", g_containerTexCoords.length / 2, "vertices")
    } else {
      console.error("Container model loaded but has no vertices")
    }
  } catch (error) {
    console.error("Error loading container model:", error)
  }

  // Load extra cottage model
  try {
    console.log("Loading extra cottage model...")
    const extraCottageData = await fetch("./resources/ExtraCottage/Cottage_FREE.obj").then((response) =>
      response.text(),
    )

    // Clear arrays
    g_extraCottageMesh = []
    g_extraCottageNormals = []
    g_extraCottageTexCoords = []

    // Parse the extra cottage OBJ file
    readObjFile(extraCottageData, g_extraCottageMesh, g_extraCottageNormals, g_extraCottageTexCoords)

    // Check if we got valid data
    if (g_extraCottageMesh.length > 0) {
      g_extraCottageLoaded = true
      console.log("Extra cottage model loaded successfully with", g_extraCottageMesh.length / 3, "triangles")
    } else {
      console.error("Extra cottage model loaded but has no vertices")
    }
  } catch (error) {
    console.error("Error loading extra cottage model:", error)
  }

  // Load spaceship model
  try {
    console.log("Loading spaceship model...")
    const spaceshipData = await fetch("./resources/spaceship/Quarren Coyote Ship.obj").then((response) =>
      response.text(),
    )

    // Clear arrays before parsing
    g_spaceshipMesh = []
    g_spaceshipNormals = []
    g_spaceshipTexCoords = []

    // Parse the spaceship OBJ file
    readObjFile(spaceshipData, g_spaceshipMesh, g_spaceshipNormals, g_spaceshipTexCoords)

    // Check if we got valid data
    if (g_spaceshipMesh.length > 0) {
      g_spaceshipLoaded = true
      console.log("Spaceship model loaded successfully with", g_spaceshipMesh.length / 3, "triangles")
    } else {
      console.error("Extra cottage model loaded but has no vertices")
    }
  } catch (error) {
    console.error("Error loading spaceship model:", error)
  }

  // Load cloud models from the path
  const cloudFiles = ["./resources/cloudOBJ/CloudCollection.obj"]

  // Clear previous cloud data
  g_cloudMeshes = []
  g_cloudNormals = []
  g_cloudTexCoords = []

  // Load each cloud model with its texture coordinates and normals
  for (const cloudFile of cloudFiles) {
    const cloudData = await fetch(cloudFile).then((response) => response.text())

    const cloudMesh = []
    const cloudNormals = []
    const cloudTexCoords = []

    // read obj
    readObjFile(cloudData, cloudMesh, cloudNormals, cloudTexCoords)

    // Add the cloud data to our arrays
    g_cloudNormals.push(cloudNormals)
    g_cloudMeshes.push(cloudMesh)
    g_cloudTexCoords.push(cloudTexCoords)
  }

  startRendering()
}

function startRendering() {
  // Initialize GPU's vertex and fragment shaders programs
  if (!initShaders(gl, g_vshader, g_fshader)) {
    console.log("Failed to intialize shaders.")
    return
  }

  // build a grid mesh
  const gridMeshData = buildGridMesh(1, 1, GRID_X_RANGE, GRID_Z_RANGE)
  g_gridMesh = gridMeshData.mesh
  g_gridNormals = gridMeshData.normals
  g_gridTexCoords = gridMeshData.texCoords

  // build a cube mesh for the light source
  g_cubeMesh = buildCubeMesh()

  // Prepare cloud data
  let allCloudVertices = []
  let allCloudNormals = []
  let allCloudTexCoords = []

  // Combine all cloud meshes into single arrays
  for (let i = 0; i < g_cloudMeshes.length; i++) {
    allCloudVertices = allCloudVertices.concat(g_cloudMeshes[i])
    allCloudNormals = allCloudNormals.concat(g_cloudNormals[i])
    allCloudTexCoords = allCloudTexCoords.concat(g_cloudTexCoords[i])
  }

  // Prepare all data for the VBO
  var data = []

  // First add all vertex positions
  data = data.concat(g_cottageMesh)
  data = data.concat(allCloudVertices)
  data = data.concat(g_gridMesh)
  data = data.concat(g_cubeMesh)

  // Add container vertices if loaded
  if (g_containerLoaded) {
    data = data.concat(g_containerMesh)
  }

  // Add extra cottage vertices if loaded
  if (g_extraCottageLoaded) {
    data = data.concat(g_extraCottageMesh)
  }

  // Add spaceship vertices if loaded
  if (g_spaceshipLoaded) {
    data = data.concat(g_spaceshipMesh)
  }

  // Then add all normals
  data = data.concat(g_cottageNormals)
  data = data.concat(allCloudNormals)
  data = data.concat(g_gridNormals)
  data = data.concat(Array(g_cubeMesh.length).fill(0)) // Dummy normals for cube

  // Add container normals if loaded
  if (g_containerLoaded) {
    data = data.concat(g_containerNormals)
  }

  // Add extra cottage normals if loaded
  if (g_extraCottageLoaded) {
    data = data.concat(g_extraCottageNormals)
  }

  // Add spaceship normals if loaded
  if (g_spaceshipLoaded) {
    data = data.concat(g_spaceshipNormals)
  }

  // Finally adding all texture coordinates
  data = data.concat(g_cottageTexCoords)
  data = data.concat(allCloudTexCoords)
  data = data.concat(g_gridTexCoords)
  data = data.concat(Array((g_cubeMesh.length / 3) * 2).fill(0)) // Dummy texture coords for cube

  // Add container texture coordinates if loaded
  if (g_containerLoaded) {
    data = data.concat(g_containerTexCoords)
  }

  // Add extra cottage texture coordinates if loaded
  if (g_extraCottageLoaded) {
    data = data.concat(g_extraCottageTexCoords)
  }

  // Add spaceship texture coordinates if loaded
  if (g_spaceshipLoaded) {
    data = data.concat(g_spaceshipTexCoords)
  }

  console.log("Total data size:", data.length)

  if (!initVBO(new Float32Array(data))) {
    return
  }

  // offsets
  const totalVertices =
    g_cottageMesh.length +
    allCloudVertices.length +
    g_gridMesh.length +
    g_cubeMesh.length +
    (g_containerLoaded ? g_containerMesh.length : 0) +
    (g_extraCottageLoaded ? g_extraCottageMesh.length : 0) +
    (g_spaceshipLoaded ? g_spaceshipMesh.length : 0)

  // Send our vertex data to the GPU
  if (!setupVec(3, "a_Position", 0, 0)) {
    return
  }
  if (!setupVec(3, "a_Normal", 0, FLOAT_SIZE * totalVertices)) {
    return
  }
  if (!setupVec(2, "a_TexCoord", 0, FLOAT_SIZE * totalVertices * 2)) {
    return
  }

  // Get references to GLSL uniforms
  g_u_model_ref = gl.getUniformLocation(gl.program, "u_Model")
  g_u_world_ref = gl.getUniformLocation(gl.program, "u_World")
  g_u_camera_ref = gl.getUniformLocation(gl.program, "u_Camera")
  g_u_projection_ref = gl.getUniformLocation(gl.program, "u_Projection")
  g_u_inversetranspose_ref = gl.getUniformLocation(gl.program, "u_ModelWorldInverseTranspose")
  g_u_light_ref = gl.getUniformLocation(gl.program, "u_Light")
  g_u_specpower_ref = gl.getUniformLocation(gl.program, "u_SpecPower")
  g_u_flatlighting_ref = gl.getUniformLocation(gl.program, "u_FlatLighting")
  g_u_flatcolor_ref = gl.getUniformLocation(gl.program, "u_FlatColor")
  g_u_texture_ref = gl.getUniformLocation(gl.program, "u_Texture")

  // Get references to firefly uniforms
  g_u_point_lights_ref = gl.getUniformLocation(gl.program, "u_PointLights")
  g_u_point_light_count_ref = gl.getUniformLocation(gl.program, "u_PointLightCount")

  // Setup our model
  g_cottageMatrix = new Matrix4().rotate(20, 1, 0, 0).scale(0.125, 0.125, 0.125)

  // Setup cloud matrices
  setupCloudMatrices()

  // Place our model in the world
  g_worldMatrix = new Matrix4()

  // Initially place the camera in "front" and above the teapot a bit
  g_cameraDistance = 1.5
  g_cameraAngle = 90
  g_cameraHeight = 0.2

  // Setup a "reasonable" perspective matrix
  g_projectionMatrix = new Matrix4().setPerspective(90, 1, 0.1, 500)

  // Setup textures
  setupTextures()

  // Enable culling and depth
  // gl.enable(gl.CULL_FACE)
  gl.enable(gl.DEPTH_TEST)

  // Setup for ticks
  g_lastFrameMS = Date.now()

  // initial value declarations
  g_lightPosition = [0, 0, 0]
  updateLightX(-4)
  updateLightY(4)
  updateLightZ(2)
  updateSpecPower(16)

  // Initialize fireflies
  initFireflies()

  init()

  tick()
}


function setupTextures() {
  // Create and set up the cottage texture
  g_cottageTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_cottageTexturePointer)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cottageImage)

  // Check if texture dimensions are powers of 2
  const isPowerOf2 = (value) => {
    return (value & (value - 1)) === 0
  }

  if (isPowerOf2(g_cottageImage.width) && isPowerOf2(g_cottageImage.height)) {
    gl.generateMipmap(gl.TEXTURE_2D)
  } else {
    // For non-power-of-2 textures, clamp to edge
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  }

  // Grid texture
  g_gridTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_gridTexturePointer)

  // Use the canvas as the texture source
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_gridImage)

  // Canvas should be power-of-2 sized but I'll check anyway
  if (isPowerOf2(g_gridImage.width) && isPowerOf2(g_gridImage.height)) {
    gl.generateMipmap(gl.TEXTURE_2D)
    // Set texture parameters for better tiling
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  } else {
    // For non-power-of-2 textures
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  }

  // Cloud texture
  g_cloudTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_cloudTexturePointer)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cloudImage)

  if (isPowerOf2(g_cloudImage.width) && isPowerOf2(g_cloudImage.height)) {
    gl.generateMipmap(gl.TEXTURE_2D)
  }

  // Cloud texture - linear filtering
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // Set up container textures if loaded
  if (g_containerLoaded && g_containerImage) {
    console.log("Setting up container textures")

    // First container texture
    g_containerTexturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_containerTexturePointer)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_containerImage)

    if (isPowerOf2(g_containerImage.width) && isPowerOf2(g_containerImage.height)) {
      gl.generateMipmap(gl.TEXTURE_2D)

      // Set texture parameters for container
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }

    // Second container texture
    if (g_containerImage2) {
      g_containerTexturePointer2 = gl.createTexture()
      gl.bindTexture(gl.TEXTURE_2D, g_containerTexturePointer2)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_containerImage2)

      if (isPowerOf2(g_containerImage2.width) && isPowerOf2(g_containerImage2.height)) {
        gl.generateMipmap(gl.TEXTURE_2D)

        // Set texture parameters for second container texture
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      }
    }
  }

  // Set up extra cottage texture if loaded
  if (g_extraCottageLoaded && g_extraCottageImage) {
    console.log("Setting up extra cottage texture...")
    g_extraCottageTexturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_extraCottageTexturePointer)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_extraCottageImage)

    if (isPowerOf2(g_extraCottageImage.width) && isPowerOf2(g_extraCottageImage.height)) {
      gl.generateMipmap(gl.TEXTURE_2D)

      // Set texture parameters for extra cottage
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
  }

  // Set up spaceship texture if loaded
  if (g_spaceshipLoaded && g_spaceshipImage) {
    console.log("Setting up spaceship texture...")
    g_spaceshipTexturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_spaceshipTexturePointer)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_spaceshipImage)

    if (isPowerOf2(g_spaceshipImage.width) && isPowerOf2(g_spaceshipImage.height)) {
      gl.generateMipmap(gl.TEXTURE_2D)

      // Set texture parameters for spaceship
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    }
  }
}

function setupCloudMatrices() {
  // Position just one cloud in the sky
  g_cloudMatrices = [new Matrix4().translate(0, 7, -3).scale(0.07, 0.05, 0.07).rotate(30, 0, 1, 0)]
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
function init() {
  ////// setup cottage
  g_cottageMatrix = new Matrix4().translate(-5.4, -1, -2.8).rotate(-20, 1, 0, 0).concat(g_cottageMatrix)

  // Setup container matrices if container was loaded
  if (g_containerLoaded) {
    console.log("Setting up container matrices...")

    // Position the first container near the cottage but not too close
    g_containerMatrix = new Matrix4()
      .translate(-4, -1, 0) // Position near the cottage but not too close
      .rotate(90, 1, 0, 0)
      .scale(0.003, 0.003, 0.003) // Scale it down

    // Position the second container at a different location
    g_containerMatrix2 = new Matrix4()
      .translate(-4, -1, -1)
      .rotate(90, 1, 0, 0)
      .scale(0.003, 0.003, 0.003) // Same scale
  }

  // Setup extra cottage matrix if loaded
  if (g_extraCottageLoaded) {
    console.log("Setting up extra cottage matrix...")
    g_extraCottageMatrix = new Matrix4()
      .translate(-5.4, -1, -6) 
      .rotate(-10, 1, 0, 0)
      .scale(0.25, 0.25, 0.25) // Bigger than the original cottage
  }

  // Generate stars for the night sky
  generateStars()
}

function generateStars() {
  // Clear any existing stars
  g_starPositions = []
  g_starColors = []

  // Generate random star positions in a dome shape
  for (let i = 0; i < g_starCount; i++) {
    // Use spherical coordinates to distribute stars in a dome
    const theta = Math.random() * Math.PI * 2 // 0 to 2π
    const phi = Math.random() * Math.PI // 0 to π (half sphere)
    const radius = 50 + Math.random() * 30

    // Convert spherical to Cartesian coordinates
    const x = radius * Math.sin(phi) * Math.cos(theta)
    const y_star = Math.abs(radius * Math.sin(phi) * Math.sin(theta))
    const z = radius * Math.cos(phi)

    g_starPositions.push(x, y_star, z)

    // Generate random star colors (mostly white with some colored stars)
    const colorType = Math.random()
    if (colorType < 0.7) {
      // White/blue-white stars (70%)
      const brightness = 0.8 + Math.random() * 0.2
      g_starColors.push(brightness, brightness, brightness + Math.random() * 0.2)
    } else if (colorType < 0.8) {
      // Yellow/orange stars (10%)
      g_starColors.push(1.0, 0.7 + Math.random() * 0.3, 0.3 + Math.random() * 0.2)
    } else if (colorType < 0.9) {
      // Red stars (10%)
      g_starColors.push(0.9 + Math.random() * 0.1, 0.2 + Math.random() * 0.3, 0.2 + Math.random() * 0.2)
    } else {
      // Blue stars (10%)
      g_starColors.push(0.5 + Math.random() * 0.2, 0.7 + Math.random() * 0.2, 1.0)
    }
  }
}

function initFireflies() {
  g_fireflies = []
  g_fireflyLights = []

  // Create fireflies around the cottage
  for (let i = 0; i < g_fireflyCount; i++) {
    // Position fireflies in a radius around the cottage
    let angle, radius, height, x, y, z

    // Create clusters of fireflies in different areas
    if (i < g_fireflyCount * 0.4) {
      // 40% close to the cottage
      angle = Math.random() * Math.PI * 2
      radius = 1 + Math.random() * 3 // Closer to cottage
      height = 0.3 + Math.random() * 1.5 // Lower height

      x = -5.4 + Math.cos(angle) * radius // Cottage is at -5.4
      y = height
      z = -2.8 + Math.sin(angle) * radius // Cottage is at -2.8
    } else if (i < g_fireflyCount * 0.7) {
      // 30% in mid-distance
      angle = Math.random() * Math.PI * 2
      radius = 3 + Math.random() * 4 // Mid distance
      height = 0.5 + Math.random() * 2 // Mid height

      x = -5.4 + Math.cos(angle) * radius
      y = height
      z = -2.8 + Math.sin(angle) * radius
    } else {
      // 30% scattered further away
      angle = Math.random() * Math.PI * 2
      radius = 6 + Math.random() * 6 // Further away
      height = 0.2 + Math.random() * 3 // Variable height

      x = -5.4 + Math.cos(angle) * radius
      y = height
      z = -2.8 + Math.sin(angle) * radius
    }

    // Random color
    const colorIndex = Math.floor(Math.random() * g_fireflyColors.length)
    const color = g_fireflyColors[colorIndex]

    // Random phase for animation
    const phase = Math.random() * Math.PI * 2
    const speed = 0.3 + Math.random() * 1.0

    g_fireflies.push({
      position: [x, y, z],
      originalPosition: [x, y, z],
      color: color,
      phase: phase,
      speed: speed,
      intensity: 0.3 + Math.random() * 0.4, // Lower base intensity
      radius: 0.3 + Math.random() * 0.8, // Smaller movement radius
    })

    // Add to lights array (will be updated each frame)
    g_fireflyLights.push(
      x,
      y,
      z, // Position
      color[0],
      color[1],
      color[2], // Color
      0.5, // Initial intensity
    )
  }
}

function updateFireflies(deltaTime) {
  const time = Date.now() * 0.001 // Current time in seconds

  for (let i = 0; i < g_fireflies.length; i++) {
    const firefly = g_fireflies[i]

    // Calculate new position with gentle random movement
    const originalX = firefly.originalPosition[0]
    const originalY = firefly.originalPosition[1]
    const originalZ = firefly.originalPosition[2]

    // Circular movement with some vertical bobbing
    const xOffset = Math.cos(time * firefly.speed + firefly.phase) * firefly.radius
    const yOffset = Math.sin(time * 0.5 + firefly.phase) * 0.3 // Slower vertical movement
    const zOffset = Math.sin(time * firefly.speed + firefly.phase) * firefly.radius

    // Update position
    firefly.position[0] = originalX + xOffset
    firefly.position[1] = originalY + yOffset
    firefly.position[2] = originalZ + zOffset

    // Intensity
    const pulseIntensity = 0.6 + 0.4 * Math.sin(time * firefly.speed + firefly.phase)

    // Update light data for shaders
    const lightIndex = i * 7 // 7 values per light (pos, color, intensity)
    g_fireflyLights[lightIndex] = firefly.position[0]
    g_fireflyLights[lightIndex + 1] = firefly.position[1]
    g_fireflyLights[lightIndex + 2] = firefly.position[2]
    g_fireflyLights[lightIndex + 3] = firefly.color[0]
    g_fireflyLights[lightIndex + 4] = firefly.color[1]
    g_fireflyLights[lightIndex + 5] = firefly.color[2]
    g_fireflyLights[lightIndex + 6] = firefly.intensity * pulseIntensity * g_fireflyIntensity
  }
}

// drawing the fireflies
function drawFireflies() {
  // Enable blending for the glowing effect
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE)
  gl.depthMask(false)

  // Use flat lighting for fireflies
  gl.uniform1i(g_u_flatlighting_ref, true)

  // Draw each firefly
  for (let i = 0; i < g_fireflies.length; i++) {
    const firefly = g_fireflies[i]

    // Set the firefly color with pulsating intensity
    const time = Date.now() * 0.001
    const pulseIntensity = 0.6 + 0.4 * Math.sin(time * 2 * firefly.speed + firefly.phase)
    const color = [
      firefly.color[0] * pulseIntensity,
      firefly.color[1] * pulseIntensity,
      firefly.color[2] * pulseIntensity,
    ]

    gl.uniform3fv(g_u_flatcolor_ref, color)

    // Position the firefly
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(g_fireflySize, g_fireflySize, g_fireflySize).elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(...firefly.position).elements)

    // Draw a small sphere for each firefly (using the cube mesh)
    const cubeOffset =
      g_cottageMesh.length / 3 + g_cloudMeshes.reduce((sum, mesh) => sum + mesh.length / 3, 0) + g_gridMesh.length / 3
    gl.drawArrays(gl.TRIANGLES, cubeOffset, g_cubeMesh.length / 3)
  }

  // Restore GL state
  gl.depthMask(true)
  gl.disable(gl.BLEND)
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// function to apply all the logic for a single frame tick
function tick() {
  // time since the last frame
  var deltaTime

  // calculate deltaTime
  var current_time = Date.now()
  deltaTime = current_time - g_lastFrameMS
  g_lastFrameMS = current_time

  // Animate spaceship if loaded
  if (g_spaceshipLoaded) {
    // Rotate the spaceship slowly
    g_spaceshipRotation += 0.01 * deltaTime

    // Create a hovering effect
    const hoverHeight = Math.sin(current_time * 0.001) * 0.2

    // Handle spaceship launch
    let spaceshipX = 0 // Initial X position
    let spaceshipY = 5 + hoverHeight
    let spaceshipZ = -10
    let spaceshipScale = 0.01

    if (g_spaceshipLaunched) {
      const launchElapsed = (current_time - g_launchTime) / 1000 // seconds since launch

      // Significant X-axis movement (moving right)
      spaceshipX += Math.pow(launchElapsed, 1.8) * g_launchSpeed * 80

      // y movement
      spaceshipY += Math.pow(launchElapsed, 1.5) * g_launchSpeed * 30

      // z movement
      spaceshipZ -= Math.pow(launchElapsed, 1.2) * g_launchSpeed * 10

      // Gradually make the spaceship smaller as it flies away
      const distanceFactor = Math.min(launchElapsed * g_launchSpeed * 2, 0.95)
      spaceshipScale = 0.01 * (1 - distanceFactor)

      // Add some rotation during launch
      g_spaceshipRotation += 0.02 * deltaTime * launchElapsed
    }

    // Update the spaceship matrix with rotation and hovering/launch
    g_spaceshipMatrix = new Matrix4()
      .translate(spaceshipX, spaceshipY, spaceshipZ) // Position with launch effect including X movement
      .rotate(g_spaceshipRotation, 0, 1, 0) // Continuous rotation
      .scale(0.007, spaceshipScale, spaceshipScale) // Scale with distance effect
  }

  // Update fireflies
  updateFireflies(deltaTime)

  // move the camera based on user input
  if (g_movingUp) {
    g_cameraHeight += CAMERA_SPEED * deltaTime
  }
  if (g_movingDown) {
    g_cameraHeight -= CAMERA_SPEED * deltaTime
  }
  if (g_movingLeft) {
    g_cameraAngle += CAMERA_ROT_SPEED * deltaTime
  }
  if (g_movingRight) {
    g_cameraAngle -= CAMERA_ROT_SPEED * deltaTime
  }
  if (g_movingForward) {
    // note that moving "forward" means "towards the teapot"
    g_cameraDistance -= CAMERA_SPEED * deltaTime
    // we don't want to hit a distance of 0
    g_cameraDistance = Math.max(g_cameraDistance, 1)
  }
  if (g_movingBackward) {
    g_cameraDistance += CAMERA_SPEED * deltaTime
  }

  draw()

  requestAnimationFrame(tick, g_canvas)
}


function draw() {
  // Calculate the camera position from our angle and height
  camX = Math.cos((Math.PI * g_cameraAngle) / 180)
  camY = g_cameraHeight
  camZ = Math.sin((Math.PI * g_cameraAngle) / 180)
  var cameraPosition = new Vector3([camX, camY, camZ])
  cameraPosition.normalize()

  // calculate distance and turn into an array for matrix entry
  var cameraPositionArray = [
    cameraPosition.elements[0] * g_cameraDistance,
    cameraPosition.elements[1] * g_cameraDistance,
    cameraPosition.elements[2] * g_cameraDistance,
  ]

  // Build a new lookat matrix each frame
  cameraMatrix = new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)

  // Clear the canvas with a black background for night sky
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // Set point light uniforms
  gl.uniform1i(g_u_point_light_count_ref, g_fireflyCount)
  gl.uniform1fv(g_u_point_lights_ref, new Float32Array(g_fireflyLights))

  // Draw stars in the night sky first
  drawStars()

  // Draw the cottage
  // Calculate the inverse transpose of our model matrix each frame
  var inverseTranspose = new Matrix4(g_worldMatrix).multiply(g_cottageMatrix)
  inverseTranspose.invert().transpose()

  // Update with our global transformation matrices
  gl.uniformMatrix4fv(g_u_model_ref, false, g_cottageMatrix.elements)
  gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
  gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
  gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)
  gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)

  // don't use flat lighting for our cottage
  gl.uniform1i(g_u_flatlighting_ref, false)

  // Update with our light position to be behind the camera
  gl.uniform3fv(g_u_light_ref, new Float32Array(g_lightEnabled ? g_lightPosition : [0, 0, 0]))

  // Update our spec power
  gl.uniform1f(g_u_specpower_ref, g_specPower)

  // Bind the cottage texture
  gl.bindTexture(gl.TEXTURE_2D, g_cottageTexturePointer)

  // Draw our cottage model
  gl.drawArrays(gl.TRIANGLES, 0, g_cottageMesh.length / 3)

  // Draw the extra cottage if loaded
  if (g_extraCottageLoaded) {
    // Calculate the inverse transpose for the extra cottage
    var extraCottageInverseTranspose = new Matrix4(g_worldMatrix).multiply(g_extraCottageMatrix)
    extraCottageInverseTranspose.invert().transpose()

    // Update matrices for the extra cottage
    gl.uniformMatrix4fv(g_u_model_ref, false, g_extraCottageMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, extraCottageInverseTranspose.elements)

    // Bind the extra cottage texture
    gl.bindTexture(gl.TEXTURE_2D, g_extraCottageTexturePointer)

    // Draw the extra cottage model
    gl.drawArrays(gl.TRIANGLES, 0, g_extraCottageMesh.length / 3)
  }

  // Draw clouds with texture
  let cloudVertexOffset = g_cottageMesh.length / 3
  gl.enable(gl.CULL_FACE)
  // Enable alpha blending for clouds with improved blend function
  //gl.enable(gl.BLEND)
  //gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // Disable depth writing for transparent clouds but keep depth testing
  //gl.depthMask(false)

  // Bind the cloud texture
  gl.bindTexture(gl.TEXTURE_2D, g_cloudTexturePointer)

  // Draw each cloud
  for (let i = 0; i < g_cloudMeshes.length && i < g_cloudMatrices.length; i++) {
    const cloudMesh = g_cloudMeshes[i]
    const cloudMatrix = g_cloudMatrices[i]

    // Calculate the inverse transpose for the cloud
    var cloudInverseTranspose = new Matrix4(g_worldMatrix).multiply(cloudMatrix)
    cloudInverseTranspose.invert().transpose()

    // Update matrices for the cloud
    gl.uniformMatrix4fv(g_u_model_ref, false, cloudMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, cloudInverseTranspose.elements)

    // Use texture for clouds instead of flat lighting
    gl.uniform1i(g_u_flatlighting_ref, false)

    // Draw the cloud model

    gl.drawArrays(gl.TRIANGLES, cloudVertexOffset, cloudMesh.length / 3)

    // Update offset for the next cloud
    cloudVertexOffset += cloudMesh.length / 3
  }

  // Re-enable depth writing after drawing clouds
  gl.depthMask(true)
  gl.disable(gl.CULL_FACE)

  // Disable blending after drawing clouds
  gl.disable(gl.BLEND)

  // Draw the grid with texture
  gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
  gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(0, GRID_Y_OFFSET, 0).elements)

  // Calculate the inverse transpose for the grid
  var gridInverseTranspose = new Matrix4().translate(0, GRID_Y_OFFSET, 0)
  gridInverseTranspose.invert().transpose()
  gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, gridInverseTranspose.elements)

  // Use texture for the grid instead of flat lighting
  gl.uniform1i(g_u_flatlighting_ref, false)

  // Bind the grid texture
  gl.bindTexture(gl.TEXTURE_2D, g_gridTexturePointer)

  // Draw the grid as triangles
  gl.drawArrays(gl.TRIANGLES, cloudVertexOffset, g_gridMesh.length / 3)

  // Draw the light source cube only if light is enabled
  if (g_lightEnabled) {
    gl.uniform3fv(g_u_flatcolor_ref, [1, 1, 1])
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(0.1, 0.1, 0.1).elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().scale(0.1, 0.1, 0.1).elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(...g_lightPosition).elements)
    gl.uniform1i(g_u_flatlighting_ref, true)
    // Use the cube mesh for the light source
    const cubeOffset = cloudVertexOffset + g_gridMesh.length / 3
    gl.drawArrays(gl.TRIANGLES, cubeOffset, g_cubeMesh.length / 3)
  }

  // Draw containers if loaded
  if (g_containerLoaded) {
    // Calculate the vertex offset for the container
    const containerOffset = cloudVertexOffset + g_gridMesh.length / 3 + g_cubeMesh.length / 3

    // Draw the first container
    // Calculate the inverse transpose for the container
    var containerInverseTranspose = new Matrix4(g_worldMatrix).multiply(g_containerMatrix)
    containerInverseTranspose.invert().transpose()

    // Update matrices for the container
    gl.uniformMatrix4fv(g_u_model_ref, false, g_containerMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, containerInverseTranspose.elements)

    // Use texture for container instead of flat lighting
    gl.uniform1i(g_u_flatlighting_ref, false)

    // Bind the container texture
    gl.bindTexture(gl.TEXTURE_2D, g_containerTexturePointer)

    // Draw the container model
    gl.drawArrays(gl.TRIANGLES, containerOffset, g_containerMesh.length / 3)

    // Draw the second container with a different texture
    var container2InverseTranspose = new Matrix4(g_worldMatrix).multiply(g_containerMatrix2)
    container2InverseTranspose.invert().transpose()

    // Update matrices for the second container
    gl.uniformMatrix4fv(g_u_model_ref, false, g_containerMatrix2.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, container2InverseTranspose.elements)

    // Bind the second container texture if available
    if (g_containerTexturePointer2) {
      gl.bindTexture(gl.TEXTURE_2D, g_containerTexturePointer2)
    }

    // Draw the second container model
    gl.drawArrays(gl.TRIANGLES, containerOffset, g_containerMesh.length / 3)
  }

  // Draw spaceship if loaded
  if (g_spaceshipLoaded) {
    // Calculate the vertex offset for the spaceship
    const spaceshipOffset =
      cloudVertexOffset +
      g_gridMesh.length / 3 +
      g_cubeMesh.length / 3 +
      (g_containerLoaded ? g_containerMesh.length / 3 : 0) +
      (g_extraCottageLoaded ? g_extraCottageMesh.length / 3 : 0)

    // Calculate the inverse transpose for the spaceship
    var spaceshipInverseTranspose = new Matrix4(g_worldMatrix).multiply(g_spaceshipMatrix)
    spaceshipInverseTranspose.invert().transpose()

    // Update matrices for the spaceship
    gl.uniformMatrix4fv(g_u_model_ref, false, g_spaceshipMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, spaceshipInverseTranspose.elements)

    // Use texture for spaceship instead of flat lighting
    gl.uniform1i(g_u_flatlighting_ref, false)

    // Bind the spaceship texture
    gl.bindTexture(gl.TEXTURE_2D, g_spaceshipTexturePointer)

    // Draw the spaceship model
    gl.drawArrays(gl.TRIANGLES, spaceshipOffset, g_spaceshipMesh.length / 3)
  }

  // Draw fireflies after everything else
  drawFireflies()
}

function drawStars() {
  // Save the current GL state
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE) // blending

  // Set up the camera and projection matrices
  gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
  gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

  // Use flat lighting for stars
  gl.uniform1i(g_u_flatlighting_ref, true)

  // Draw each star
  for (let i = 0; i < g_starCount; i++) {
    // Set the star color with higher brightness
    gl.uniform3fv(g_u_flatcolor_ref, [g_starColors[i * 3], g_starColors[i * 3 + 1], g_starColors[i * 3 + 2]])

    // Position the star
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(g_starSize, g_starSize, g_starSize).elements)
    gl.uniformMatrix4fv(
      g_u_world_ref,
      false,
      new Matrix4().translate(g_starPositions[i * 3], g_starPositions[i * 3 + 1], g_starPositions[i * 3 + 2]).elements,
    )

    // Draw a point for the star (using the cube mesh)
    gl.drawArrays(gl.TRIANGLES, 0, 36) 
  }

  // Restore GL state
  gl.disable(gl.BLEND)
  gl.enable(gl.DEPTH_TEST)
}

function updateLightX(amount) {
  const lightXLabel = document.getElementById("lightX")
  lightXLabel.textContent = `Light X: ${Number(amount).toFixed(2)}`
  g_lightPosition[0] = Number(amount)
}

function updateLightY(amount) {
  const lightYLabel = document.getElementById("lightY")
  lightYLabel.textContent = `Light Y: ${Number(amount).toFixed(2)}`
  g_lightPosition[1] = Number(amount)
}

function updateLightZ(amount) {
  const lightZLabel = document.getElementById("lightZ")
  lightZLabel.textContent = `Light Z: ${Number(amount).toFixed(2)}`
  g_lightPosition[2] = Number(amount)
}

function updateSpecPower(amount) {
  const specPowerLabel = document.getElementById("specPower")
  specPowerLabel.textContent = `Specular Power: ${Number(amount).toFixed(0)}`
  g_specPower = Number(amount)
}

/*
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
  // Start movement when the key starts being pressed
  document.addEventListener("keydown", (event) => {
    if (event.key == "r") {
      g_movingUp = true
    } else if (event.key == "f") {
      g_movingDown = true
    } else if (event.key == "a") {
      g_movingLeft = true
    } else if (event.key == "d") {
      g_movingRight = true
    } else if (event.key == "w") {
      g_movingForward = true
    } else if (event.key == "s") {
      g_movingBackward = true
    }
  })

  // End movement on key release
  document.addEventListener("keyup", (event) => {
    if (event.key == "r") {
      g_movingUp = false
    } else if (event.key == "f") {
      g_movingDown = false
    } else if (event.key == "a") {
      g_movingLeft = false
    } else if (event.key == "d") {
      g_movingRight = false
    } else if (event.key == "w") {
      g_movingForward = false // FIXED: Was incorrectly set to true
    } else if (event.key == "s") {
      g_movingBackward = false // FIXED: Was incorrectly set to true
    }
  })
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
  // get the VBO handle
  var VBOloc = gl.createBuffer()
  if (!VBOloc) {
    console.log("Failed to create the vertex buffer object")
    return false
  }

  // Bind the VBO to the GPU array and copy `data` into that VBO
  gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)

  return true
}

/*
 * Helper function to load the given vec3 data chunk onto the VBO
 * Requires that the VBO already be setup and assigned to the GPU
 */
function setupVec(size, name, stride, offset) {
  // Get the attribute by name
  var attributeID = gl.getAttribLocation(gl.program, `${name}`)
  if (attributeID < 0) {
    console.log(`Failed to get the storage location of ${name}`)
    return false
  }

  // Set how the GPU fills the a_Position variable with data from the GPU
  gl.vertexAttribPointer(attributeID, size, gl.FLOAT, false, stride, offset)
  gl.enableVertexAttribArray(attributeID)

  return true
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Send to HTML

window.main = main

