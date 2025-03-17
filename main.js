// Last edited by Brighton Sibanda

import { GRID_X_RANGE, GRID_Z_RANGE, GRID_Y_OFFSET, FLOAT_SIZE, CAMERA_SPEED, CAMERA_ROT_SPEED } from "./extras.js"
// references to the GLSL programs we need to load
var g_vshader
var g_fshader

// references to general information
var g_canvas
var gl
var g_lastFrameMS

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

// usual model/world matrices
var g_cottageMatrix
var g_worldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at the teapot
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// the current axis of rotation
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
var g_cloudTexturePointer // Added for cloud texture

// Light position
var g_lightPosition

// Spec Power
var g_specPower

// Key states
var g_movingUp, g_movingDown, g_movingLeft, g_movingRight, g_movingForward
var g_movingBackward

var g_cloudMeshes = [] // Added for clouds
var g_cloudMatrices = [] // Added for cloud transformations
var g_cloudTexCoords = [] // Added for cloud texture coordinates
var g_cloudNormals = []

// Cottage mesh data
var g_cottageMesh = []
var g_cottageNormals = []
var g_cottageTexCoords = []

// Cube mesh for light source
var g_cubeMesh

// Add these variables at the top of the file with the other global variables
var g_starPositions = []
var g_starColors = []
var g_starCount = 2000 // Increased number of stars
var g_starSize = 0.05 // Size of stars

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
}

// Function to convert any image to a power-of-two sized texture
function createPowerOfTwoTexture(image) {
  // Find the next power of 2 size
  const nextPowerOf2 = (value) => {
    let power = 1
    while (power < value) {
      power *= 2
    }
    return power
  }

  const width = nextPowerOf2(image.width)
  const height = nextPowerOf2(image.height)

  // Create a canvas of power-of-two size
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")

  // Fill the canvas by repeating the image
  const pattern = ctx.createPattern(image, "repeat")
  ctx.fillStyle = pattern
  ctx.fillRect(0, 0, width, height)

  console.log(`Converted texture from ${image.width}x${image.height} to ${width}x${height}`)

  return canvas
}

async function loadImageFiles() {
  g_cottageImage = new Image()
  g_cottageImage.src = "./resources/85-cottage_obj/cottage_diffuse_upside_down.png"
  await g_cottageImage.decode()

  // Trees have been removed

  // Load the grid texture
  const tempImage = new Image()
  tempImage.src = "./resources/mountain/ground_grass_3264_4062_Small.jpg"
  tempImage.crossOrigin = "anonymous"
  await tempImage.decode()

  // Convert to power-of-two texture
  g_gridImage = createPowerOfTwoTexture(tempImage)

  // Load the cloud texture
  const cloudTempImage = new Image()
  cloudTempImage.src = "./resources/clouds/cloud.png"
  cloudTempImage.crossOrigin = "anonymous"
  await cloudTempImage.decode()

  // Convert to power-of-two texture
  g_cloudImage = createPowerOfTwoTexture(cloudTempImage)

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

// Update the loadOBJFiles function to ensure normals are properly processed
async function loadOBJFiles() {
  // Trees have been removed

  // Load the cottage model
  const cottageData = await fetch("./resources/85-cottage_obj/cottage_tri.obj").then((response) => response.text())

  // Parse the cottage OBJ file to get mesh, normals, and texture coordinates
  g_cottageMesh = []
  g_cottageNormals = []
  g_cottageTexCoords = []
  readObjFile(cottageData, g_cottageMesh, g_cottageNormals, g_cottageTexCoords)

  // Load cloud models from the new path
  const cloudFiles = [
    "./resources/clouds/altostratus00.obj",
    "./resources/clouds/altostratus01.obj",
    "./resources/clouds/cumulus00.obj",
    "./resources/clouds/cumulus01.obj",
    "./resources/clouds/cumulus02.obj",
  ]

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

    // Use the readObjFile function to parse the OBJ file with texture coordinates and normals
    readObjFile(cloudData, cloudMesh, cloudNormals, cloudTexCoords)

    // Ensure normals are properly set for smooth shading
    // If the model doesn't have enough normals, we'll generate smooth normals
    if (cloudNormals.length < cloudMesh.length) {
      console.log(`Generating smooth normals for ${cloudFile}`)
      const smoothNormals = generateSmoothNormals(cloudMesh)
      g_cloudNormals.push(smoothNormals)
    } else {
      g_cloudNormals.push(cloudNormals)
    }

    g_cloudMeshes.push(cloudMesh)
    g_cloudTexCoords.push(cloudTexCoords)
  }

  startRendering()
}

// Add a function to generate simple texture coordinates for models that don't have them
function generateSimpleTexCoords(mesh, texCoords) {
  const vertexCount = mesh.length / 3

  for (let i = 0; i < vertexCount; i++) {
    // Get the vertex position
    const x = mesh[i * 3]
    const y = mesh[i * 3 + 1]
    const z = mesh[i * 3 + 2]

    // Generate simple texture coordinates based on position
    // This is a simple mapping that might work for tree-like objects
    // For better results, you might need a more sophisticated approach
    const u = Math.atan2(z, x) / (2 * Math.PI) + 0.5 // Map angle to [0,1]
    const v = (y + 1) / 2 // Map height to [0,1] assuming y is in [-1,1]

    texCoords.push(u, v)
  }
}

// Add a function to generate smooth normals for cloud meshes
function generateSmoothNormals(mesh) {
  const normals = []
  const vertexCount = mesh.length / 3

  // Create a map to store accumulated normals for each vertex position
  const vertexNormals = new Map()

  // Process each triangle
  for (let i = 0; i < vertexCount; i += 3) {
    // Get the three vertices of the triangle
    const v1 = [mesh[i * 3], mesh[i * 3 + 1], mesh[i * 3 + 2]]
    const v2 = [mesh[(i + 1) * 3], mesh[(i + 1) * 3 + 1], mesh[(i + 1) * 3 + 2]]
    const v3 = [mesh[(i + 2) * 3], mesh[(i + 2) * 3 + 1], mesh[(i + 2) * 3 + 2]]

    // Calculate the face normal using cross product
    const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
    const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]
    const normal = [
      edge1[1] * edge2[2] - edge1[2] * edge2[1],
      edge1[2] * edge2[0] - edge1[0] * edge2[2],
      edge1[0] * edge2[1] - edge1[1] * edge2[0],
    ]

    // Normalize the normal
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
    if (length > 0) {
      normal[0] /= length
      normal[1] /= length
      normal[2] /= length
    }

    // Add this normal to each vertex of the triangle
    for (let j = 0; j < 3; j++) {
      const vertexKey = `${mesh[(i + j) * 3]},${mesh[(i + j) * 3 + 1]},${mesh[(i + j) * 3 + 2]}`
      if (!vertexNormals.has(vertexKey)) {
        vertexNormals.set(vertexKey, [normal[0], normal[1], normal[2]])
      } else {
        const existingNormal = vertexNormals.get(vertexKey)
        existingNormal[0] += normal[0]
        existingNormal[1] += normal[1]
        existingNormal[2] += normal[2]
        vertexNormals.set(vertexKey, existingNormal)
      }
    }
  }

  // Normalize all accumulated normals
  for (const [key, normal] of vertexNormals.entries()) {
    const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
    if (length > 0) {
      normal[0] /= length
      normal[1] /= length
      normal[2] /= length
    }
  }

  // Create the final normals array in the same order as the vertices
  for (let i = 0; i < vertexCount; i++) {
    const vertexKey = `${mesh[i * 3]},${mesh[i * 3 + 1]},${mesh[i * 3 + 2]}`
    const normal = vertexNormals.get(vertexKey) || [0, 1, 0] // Default to up if not found
    normals.push(normal[0], normal[1], normal[2])
  }

  return normals
}

// Update the startRendering function to use the loaded normals and texture coordinates
function startRendering() {
  // Initialize GPU's vertex and fragment shaders programs
  if (!initShaders(gl, g_vshader, g_fshader)) {
    console.log("Failed to intialize shaders.")
    return
  }

  // build a grid mesh
  const gridMeshData = buildGridMesh(1, 1)
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

  var data = g_cottageMesh
    .concat(allCloudVertices)
    .concat(g_gridMesh)
    .concat(g_cubeMesh) // Add the cube mesh
    .concat(g_cottageNormals)
    .concat(allCloudNormals)
    .concat(g_gridNormals)
    .concat(Array(g_cubeMesh.length).fill(0)) // Add dummy normals for the cube
    .concat(g_cottageTexCoords)
    .concat(allCloudTexCoords)
    .concat(g_gridTexCoords)
    .concat(Array((g_cubeMesh.length / 3) * 2).fill(0)) // Add dummy texture coords for the cube

  if (!initVBO(new Float32Array(data))) {
    return
  }

  // Send our vertex data to the GPU
  if (!setupVec(3, "a_Position", 0, 0)) {
    return
  }
  if (
    !setupVec(
      3,
      "a_Normal",
      0,
      FLOAT_SIZE * (g_cottageMesh.length + allCloudVertices.length + g_gridMesh.length + g_cubeMesh.length),
    )
  ) {
    return
  }
  if (
    !setupVec(
      2,
      "a_TexCoord",
      0,
      FLOAT_SIZE * (g_cottageMesh.length + allCloudVertices.length + g_gridMesh.length + g_cubeMesh.length) * 2,
    )
  ) {
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

  init()

  tick()
}

// Update the setupTextures function to include tree textures
function setupTextures() {
  // Create and set up the cottage texture
  g_cottageTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_cottageTexturePointer)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cottageImage)
  gl.generateMipmap(gl.TEXTURE_2D)

  // Trees have been removed

  // Create and set up the grid texture
  g_gridTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_gridTexturePointer)

  // Use the canvas as the texture source
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_gridImage)
  gl.generateMipmap(gl.TEXTURE_2D)

  // Set texture parameters for better tiling
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  // Create and set up the cloud texture
  g_cloudTexturePointer = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, g_cloudTexturePointer)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cloudImage)
  gl.generateMipmap(gl.TEXTURE_2D)

  // Set texture parameters for clouds - use LINEAR filtering for smoother appearance
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
}

// Add a function to set up cloud matrices
function setupCloudMatrices() {
  // Position clouds at different locations in the sky
  g_cloudMatrices = [
    // Small cloud
    new Matrix4()
      .translate(-3, 6, -3)
      .scale(0.05, 0.03, 0.05)
      .rotate(30, 0, 1, 0),
    // Medium cloud
    new Matrix4()
      .translate(2, 6.5, -2)
      .scale(0.06, 0.04, 0.06)
      .rotate(60, 0, 1, 0),
    // Large cloud
    new Matrix4()
      .translate(0, 7, -4)
      .scale(0.07, 0.05, 0.07)
      .rotate(15, 0, 1, 0),
    // Long cloud
    new Matrix4()
      .translate(-4, 7.2, -5)
      .scale(0.08, 0.03, 0.06)
      .rotate(45, 0, 1, 0),
    // Small cloud 2
    new Matrix4()
      .translate(4, 6.8, -3)
      .scale(0.05, 0.03, 0.05)
      .rotate(75, 0, 1, 0),
    // Additional clouds for variety
    new Matrix4()
      .translate(1, 7.5, -2.5)
      .scale(0.06, 0.04, 0.06)
      .rotate(20, 0, 1, 0),
    new Matrix4().translate(-2, 8, -4).scale(0.07, 0.05, 0.07).rotate(50, 0, 1, 0),
    new Matrix4().translate(3, 7.8, -5).scale(0.5, 0.03, 0.05).rotate(10, 0, 1, 0),
    new Matrix4().translate(-3, 8.2, -2).scale(0.6, 0.4, 0.6).rotate(35, 0, 1, 0),
    // Higher altitude clouds
    new Matrix4()
      .translate(0, 9, -6)
      .scale(0.9, 0.4, 0.9)
      .rotate(25, 0, 1, 0),
    new Matrix4().translate(-5, 8.5, -3).scale(0.8, 0.3, 0.8).rotate(65, 0, 1, 0),
  ]
}

//////////////////////////////////////////////////////////////////////////////////////////////////////////////
function init() {
  ////// setup cottage
  g_cottageMatrix = new Matrix4().translate(-5.4, -1, -2.8).rotate(-20, 1, 0, 0).concat(g_cottageMatrix)

  // Generate stars for the night sky
  generateStars()
}

// Add this function after the init() function
function generateStars() {
  // Clear any existing stars
  g_starPositions = []
  g_starColors = []

  // Generate random star positions in a dome shape
  for (let i = 0; i < g_starCount; i++) {
    // Use spherical coordinates to distribute stars in a dome
    const theta = Math.random() * Math.PI * 2 // 0 to 2π
    const phi = (Math.random() * Math.PI) // 0 to π/2 (half sphere)
    const radius = 50 + Math.random() * 30 // Reduced distance from center

    // Convert spherical to Cartesian coordinates
    const x = radius * Math.sin(phi) * Math.cos(theta)
    const y = Math.abs(radius * Math.sin(phi) * Math.sin(theta)) // Make sure y is positive
    const z = radius * Math.cos(phi)

    g_starPositions.push(x, y, z)

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

//////////////////////////////////////////////////////////////////////////////////////////////////////////////

// function to apply all the logic for a single frame tick
function tick() {
  // time since the last frame
  var deltaTime

  // calculate deltaTime
  var current_time = Date.now()
  deltaTime = current_time - g_lastFrameMS
  g_lastFrameMS = current_time

  // Animate clouds - make them drift slowly with subtle vertical movement
  for (let i = 0; i < g_cloudMatrices.length; i++) {
    // Different speeds and movement patterns for different clouds
    const cloudSpeed = 0.00005 * (i + 1)
    const verticalSpeed = 0.00002 * ((i % 3) + 1)

    // Create subtle horizontal and vertical movement
    g_cloudMatrices[i] = new Matrix4()
      .translate(Math.sin(current_time * cloudSpeed) * 0.003, Math.sin(current_time * verticalSpeed) * 0.001, 0)
      .concat(g_cloudMatrices[i])
  }

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

// Update the draw function to improve cloud rendering
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

  // Clear the canvas with a sky blue background
  // gl.clearColor(135 / 255, 206 / 255, 235 / 255, 1) // Sky blue background
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

  // Draw stars in the night sky first (before other objects)
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
  gl.uniform3fv(g_u_light_ref, new Float32Array(g_lightPosition))

  // Update our spec power
  gl.uniform1f(g_u_specpower_ref, g_specPower)

  // Bind the cottage texture
  gl.bindTexture(gl.TEXTURE_2D, g_cottageTexturePointer)

  // Draw our cottage model
  gl.drawArrays(gl.TRIANGLES, 0, g_cottageMesh.length / 3)

  // Trees have been removed

  // Draw clouds with texture
  let cloudVertexOffset = g_cottageMesh.length / 3

  // Enable alpha blending for clouds with improved blend function
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // Disable depth writing for transparent clouds but keep depth testing
  gl.depthMask(false)

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

  // Disable blending after drawing clouds
  gl.disable(gl.BLEND)

  // Draw the grid with texture
  // Set up the grid's model and world matrices
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

  // draw the light source as a white cube
  gl.uniform3fv(g_u_flatcolor_ref, [1, 1, 1])
  gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(0.1, 0.1, 0.1).elements)
  gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(...g_lightPosition).elements)
  gl.uniform1i(g_u_flatlighting_ref, true)
  // Use the cube mesh for the light source
  const cubeOffset = cloudVertexOffset + g_gridMesh.length / 3
  gl.drawArrays(gl.TRIANGLES, cubeOffset, g_cubeMesh.length / 3)
}

// Change the drawStars function to draw stars directly
function drawStars() {
  // Save the current GL state
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE) // Additive blending for glow effect

  // Set up the camera and projection matrices
  gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
  gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

  // Use flat lighting for stars
  gl.uniform1i(g_u_flatlighting_ref, true)

  // Draw each star
  for (let i = 0; i < g_starCount; i++) {
    // Set the star color with higher brightness
    gl.uniform3fv(g_u_flatcolor_ref, [g_starColors[i * 3], g_starColors[i * 3 + 1], g_starColors[i * 3 + 2]])

    // Position the star - use a larger size for better visibility
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(g_starSize, g_starSize, g_starSize).elements)
    gl.uniformMatrix4fv(
      g_u_world_ref,
      false,
      new Matrix4().translate(g_starPositions[i * 3], g_starPositions[i * 3 + 1], g_starPositions[i * 3 + 2]).elements,
    )

    // Draw a point for the star (using the cube mesh)
    gl.drawArrays(gl.TRIANGLES, 0, 36) // Draw a small cube for each star
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
      g_movingForward = false
    } else if (event.key == "s") {
      g_movingBackward = false
    }
  })
}

/*
 * Helper function to build a grid mesh (with texture coordinates)
 * Returns these results as an object with mesh, normals, and texCoords
 */
function buildGridMesh(grid_row_spacing, grid_column_spacing) {
  var mesh = []
  var normals = []
  var texCoords = []

  // Create a single large quad for the grid
  const size = Math.max(GRID_X_RANGE, GRID_Z_RANGE)

  // Create a plane with 4 vertices (2 triangles)
  // First triangle
  mesh.push(-size, 0, -size) // bottom-left
  mesh.push(size, 0, -size) // bottom-right
  mesh.push(-size, 0, size) // top-left

  // Second triangle
  mesh.push(size, 0, -size) // bottom-right
  mesh.push(size, 0, size) // top-right
  mesh.push(-size, 0, size) // top-left

  // Add normals (all pointing up)
  for (let i = 0; i < 6; i++) {
    normals.push(0, 1, 0)
  }

  // Add texture coordinates
  // Scale factor to repeat the texture across the grid
  const texRepeat = 20 // Adjust this value to control texture tiling

  // First triangle
  texCoords.push(0, 0)
  texCoords.push(texRepeat, 0)
  texCoords.push(0, texRepeat)

  // Second triangle
  texCoords.push(texRepeat, 0)
  texCoords.push(texRepeat, texRepeat)
  texCoords.push(0, texRepeat)

  return { mesh, normals, texCoords }
}

/*
 * Helper function to build a cube mesh
 * Returns the vertices for a unit cube
 */
function buildCubeMesh() {
  // Define the 8 vertices of a unit cube
  const vertices = [
    // Front face
    -0.5,
    -0.5,
    0.5, // 0
    0.5,
    -0.5,
    0.5, // 1
    0.5,
    0.5,
    0.5, // 2
    -0.5,
    0.5,
    0.5, // 3

    // Back face
    -0.5,
    -0.5,
    -0.5, // 4
    0.5,
    -0.5,
    -0.5, // 5
    0.5,
    0.5,
    -0.5, // 6
    -0.5,
    0.5,
    -0.5, // 7
  ]

  // Define the 12 triangles (36 vertices) using the 8 vertices above
  const indices = [
    // Front face
    0, 1, 2, 0, 2, 3,
    // Back face
    4, 6, 5, 4, 7, 6,
    // Top face
    3, 2, 6, 3, 6, 7,
    // Bottom face
    0, 5, 1, 0, 4, 5,
    // Right face
    1, 5, 6, 1, 6, 2,
    // Left face
    0, 3, 7, 0, 7, 4,
  ]

  // Create the mesh by expanding the indices
  const mesh = []
  for (let i = 0; i < indices.length; i++) {
    const vertexIndex = indices[i]
    mesh.push(vertices[vertexIndex * 3])
    mesh.push(vertices[vertexIndex * 3 + 1])
    mesh.push(vertices[vertexIndex * 3 + 2])
  }

  return mesh
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

