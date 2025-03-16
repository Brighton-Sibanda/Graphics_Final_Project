// Last edited by Brighton Sibanda

import {
    CUBE_MESH,
    CUBE_NORMALS,
    CUBE_TEX_MAPPING,
    GRID_X_RANGE,
    GRID_Z_RANGE,
    GRID_Y_OFFSET,
    FLOAT_SIZE,
    ROTATION_SPEED,
    CAMERA_SPEED,
    CAMERA_ROT_SPEED,
  } from "./extras.js"
  
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
  var g_cubeMatrix
  var g_worldMatrix
  var g_projectionMatrix
  var g_treeMatrix // Added for tree
  
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
  var g_cubeImage
  var g_gridImage
  var g_cloudImage
  var g_cubeTexturePointer
  var g_gridTexturePointer
  var g_cloudTexturePointer // Added for cloud texture
  
  // Light position
  var g_lightPosition
  
  // Spec Power
  var g_specPower
  
  // Key states
  var g_movingUp, g_movingDown, g_movingLeft, g_movingRight, g_movingForward
  var g_movingBackward
  
  // Tree mesh
  var g_treeMesh // Added for tree
  var g_cloudMeshes = [] // Added for clouds
  var g_cloudMatrices = [] // Added for cloud transformations
  var g_cloudTexCoords = [] // Added for cloud texture coordinates
  var g_cloudNormals = []
  
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
    g_cubeImage = new Image()
    g_cubeImage.src = "./resources/textures/brick_resized.png"
    await g_cubeImage.decode()
  
    // Load the grid texture
    const tempImage = new Image()
    tempImage.src = "./resources/mountain/ground_grass_3264_4062_Small.jpg" // Make sure this path is correct
    tempImage.crossOrigin = "anonymous" // Add this to prevent CORS issues
    await tempImage.decode()
  
    // Convert to power-of-two texture
    g_gridImage = createPowerOfTwoTexture(tempImage)
  
    // Load the cloud texture - use a more suitable cloud texture with soft edges
    const cloudTempImage = new Image()
    cloudTempImage.src = "./resources/clouds/cloud.png" // Update this path to your cloud texture
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
    // Load the tree model
    const treeData = await fetch("./resources/low_poly_tree/Lowpoly_tree_sample.obj").then((response) => response.text())
  
    g_treeMesh = []
    readObjFile(treeData, g_treeMesh)
  
    // Load cloud models from the new path
    const cloudFiles = [
      "./resources/cloudOBJ/CloudSmall.obj",
      "./resources/cloudOBJ/CloudMedium.obj",
      "./resources/cloudOBJ/CloudLarge.obj",
      "./resources/cloudOBJ/CloudLong.obj",
      "./resources/cloudOBJ/CloudSmall2.obj",
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
  
    // Create dummy normals and texture coordinates for the tree
    const treeDummyNormals = Array(g_treeMesh.length).fill(0)
    const treeDummyTexCoords = Array((g_treeMesh.length / 3) * 2).fill(0)
  
    var data = CUBE_MESH.concat(g_treeMesh)
      .concat(allCloudVertices)
      .concat(g_gridMesh)
      .concat(CUBE_NORMALS)
      .concat(treeDummyNormals)
      .concat(allCloudNormals)
      .concat(g_gridNormals)
      .concat(CUBE_TEX_MAPPING)
      .concat(treeDummyTexCoords)
      .concat(allCloudTexCoords)
      .concat(g_gridTexCoords)
  
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
        FLOAT_SIZE * (CUBE_MESH.length + g_treeMesh.length + allCloudVertices.length + g_gridMesh.length),
      )
    ) {
      return
    }
    if (
      !setupVec(
        2,
        "a_TexCoord",
        0,
        FLOAT_SIZE * (CUBE_MESH.length + g_treeMesh.length + allCloudVertices.length + g_gridMesh.length) * 2,
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
    g_cubeMatrix = new Matrix4().rotate(20, 1, 0, 0).scale(0.125, 0.125, 0.125)
  
    // Setup tree model matrix
    g_treeMatrix = new Matrix4().translate(0.5, 0, 0.5).scale(0.1, 0.1, 0.1)
  
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
  
  // Function to set up textures
  function setupTextures() {
    // Create and set up the cube texture
    g_cubeTexturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_cubeTexturePointer)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cubeImage)
    gl.generateMipmap(gl.TEXTURE_2D)
  
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
        .scale(0.5, 0.3, 0.5)
        .rotate(30, 0, 1, 0),
      // Medium cloud
      new Matrix4()
        .translate(2, 6.5, -2)
        .scale(0.6, 0.4, 0.6)
        .rotate(60, 0, 1, 0),
      // Large cloud
      new Matrix4()
        .translate(0, 7, -4)
        .scale(0.7, 0.5, 0.7)
        .rotate(15, 0, 1, 0),
      // Long cloud
      new Matrix4()
        .translate(-4, 7.2, -5)
        .scale(0.8, 0.3, 0.6)
        .rotate(45, 0, 1, 0),
      // Small cloud 2
      new Matrix4()
        .translate(4, 6.8, -3)
        .scale(0.5, 0.3, 0.5)
        .rotate(75, 0, 1, 0),
      // Additional clouds for variety
      new Matrix4()
        .translate(1, 7.5, -2.5)
        .scale(0.6, 0.4, 0.6)
        .rotate(20, 0, 1, 0),
      new Matrix4().translate(-2, 8, -4).scale(0.7, 0.5, 0.7).rotate(50, 0, 1, 0),
      new Matrix4().translate(3, 7.8, -5).scale(0.5, 0.3, 0.5).rotate(10, 0, 1, 0),
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
    ////// setup cube
    g_cubeMatrix = new Matrix4().translate(-0.4, 0, -0.8).concat(g_cubeMatrix)
  
    //// setup tree
    g_treeMatrix = new Matrix4().translate(0, -0.5, 0).scale(0.25, 0.25, 0.25).concat(g_treeMatrix)
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
  
    // rotate the teapot constantly around the given axis (of the model)
    angle = ROTATION_SPEED * deltaTime
    // g_cubeMatrix = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_cubeMatrix)
    g_cubeMatrix = new Matrix4()
      .translate(-0.4, 0, -0.8)
      .rotate(angle, 0, 1, 0)
      .translate(0.4, 0, 0.8)
      .concat(g_cubeMatrix)
  
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
    gl.clearColor(135 / 255, 206 / 255, 235 / 255, 1) // Sky blue background
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
  
    // Draw the cube
    // Calculate the inverse transpose of our model matrix each frame
    var inverseTranspose = new Matrix4(g_worldMatrix).multiply(g_cubeMatrix)
    inverseTranspose.invert().transpose()
  
    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_cubeMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, inverseTranspose.elements)
  
    // don't use flat lighting for our cube
    gl.uniform1i(g_u_flatlighting_ref, false)
  
    // Update with our light position to be behind the camera
    gl.uniform3fv(g_u_light_ref, new Float32Array(g_lightPosition))
  
    // Update our spec power
    gl.uniform1f(g_u_specpower_ref, g_specPower)
  
    // Bind the cube texture
    gl.bindTexture(gl.TEXTURE_2D, g_cubeTexturePointer)
  
    // Draw our cube model
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / 3)
  
    // Draw the tree
    // Calculate the inverse transpose for the tree
    var treeInverseTranspose = new Matrix4(g_worldMatrix).multiply(g_treeMatrix)
    treeInverseTranspose.invert().transpose()
  
    // Update matrices for the tree
    gl.uniformMatrix4fv(g_u_model_ref, false, g_treeMatrix.elements)
    gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, treeInverseTranspose.elements)
  
    // Use flat lighting for the tree since it doesn't have texture
    gl.uniform1i(g_u_flatlighting_ref, true)
    gl.uniform3fv(g_u_flatcolor_ref, [0.2, 0.5, 0.2]) // Green color for the tree
  
    // Draw the tree model
    gl.drawArrays(gl.TRIANGLES, CUBE_MESH.length / 3, g_treeMesh.length / 3)
  
    // Draw clouds with texture
    let cloudVertexOffset = CUBE_MESH.length / 3 + g_treeMesh.length / 3
  
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
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / 3)
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
        g_movingForward = true
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
  
  