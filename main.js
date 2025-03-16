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

// Texture image
var g_cubeImage

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

async function loadImageFiles() {
    g_cubeImage = new Image()
    g_cubeImage.src = "./resources/textures/brick_resized.png"
    await g_cubeImage.decode()

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

async function loadOBJFiles() {
    // Load the tree model
    const treeData = await fetch("./resources/low_poly_tree/Lowpoly_tree_sample.obj").then((response) => response.text())

    g_treeMesh = []
    readObjFile(treeData, g_treeMesh)

    // Load cloud models
    const cloudFiles = [
        "./resources/clouds/cumulus00.obj",
        "./resources/clouds/cumulus01.obj",
        "./resources/clouds/cumulus02.obj",
        "./resources/clouds/altostratus00.obj",
        "./resources/clouds/altostratus01.obj",
    ]

    // Load each cloud model
    for (const cloudFile of cloudFiles) {
        const cloudData = await fetch(cloudFile).then((response) => response.text())
        const cloudMesh = []
        readObjFile(cloudData, cloudMesh)
        g_cloudMeshes.push(cloudMesh)
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
    g_gridMesh = buildGridMesh(1, 1)

    // Prepare cloud data
    let allCloudVertices = []
    let allCloudNormals = []
    let allCloudTexCoords = []

    // Combine all cloud meshes into single arrays
    for (const cloudMesh of g_cloudMeshes) {
        allCloudVertices = allCloudVertices.concat(cloudMesh)
        // Create dummy normals and texture coordinates for clouds
        const cloudDummyNormals = Array(cloudMesh.length).fill(0)
        const cloudDummyTexCoords = Array((cloudMesh.length / 3) * 2).fill(0)
        allCloudNormals = allCloudNormals.concat(cloudDummyNormals)
        allCloudTexCoords = allCloudTexCoords.concat(cloudDummyTexCoords)
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
        .concat(g_gridMesh)
        .concat(CUBE_TEX_MAPPING)
        .concat(treeDummyTexCoords)
        .concat(allCloudTexCoords)
        .concat(g_gridMesh)

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

    // https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html
    // Create a texture and bind it to the gl texture slot thingy
    var g_texturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointer)

    // Set our new texture as the target of u_Texture
    gl.uniform1i(g_u_texture_ref, g_texturePointer)

    // Bind the texture to the u_Texture slot
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cubeImage)

    // generate a mipmap
    gl.generateMipmap(gl.TEXTURE_2D)

    // Enable culling and depth
    // gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // initial value declarations
    g_lightPosition = [0, 0, 0]
    updateLightX(0)
    updateLightY(0)
    updateLightZ(2)
    updateSpecPower(16)

    init()

    tick()
}

// Add a function to set up cloud matrices
function setupCloudMatrices() {
    // Position clouds at different locations in the sky
    g_cloudMatrices = [
        // Cumulus clouds
        new Matrix4()
            .translate(-2, 3, -2)
            .scale(0.03, 0.02, 0.03)
            .rotate(30, 0, 1, 0),
        new Matrix4().translate(2, 3.2, -1).scale(0.025, 0.015, 0.025).rotate(60, 0, 1, 0),
        new Matrix4().translate(0, 3.1, -3).scale(0.035, 0.02, 0.035).rotate(15, 0, 1, 0),
        // Altostratus clouds
        new Matrix4()
            .translate(-3, 3.5, -4)
            .scale(0.04, 0.01, 0.04)
            .rotate(45, 0, 1, 0),
        new Matrix4().translate(3, 3.4, -3).scale(0.045, 0.01, 0.045).rotate(75, 0, 1, 0),
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

    // Animate clouds - make them drift slowly
    for (let i = 0; i < g_cloudMatrices.length; i++) {
        // Different speeds for different clouds
        const cloudSpeed = 0.0001 * (i + 1)
        g_cloudMatrices[i] = new Matrix4()
            .translate(Math.sin(current_time * cloudSpeed) * 0.005, 0, 0)
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

// draw to the screen on the next frame
function draw() {
    // Calculate the camera position from our angle and height
    // we get to use a bit of clever 2D rotation math
    // note that we can only do this because we're "fixing" our plane of motion
    // if we wanted to allow arbitrary rotation, we would want quaternions!
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

    // Clear the canvas with a black background
    gl.clearColor(115/255, 215/255, 1, 1)
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

    // Draw clouds
    let cloudVertexOffset = CUBE_MESH.length / 3 + g_treeMesh.length / 3

    for (let i = 0; i < g_cloudMeshes.length; i++) {
        const cloudMesh = g_cloudMeshes[i]
        const cloudMatrix = g_cloudMatrices[i]

        // Calculate the inverse transpose for the cloud
        var cloudInverseTranspose = new Matrix4(g_worldMatrix).multiply(cloudMatrix)
        cloudInverseTranspose.invert().transpose()

        // Update matrices for the cloud
        gl.uniformMatrix4fv(g_u_model_ref, false, cloudMatrix.elements)
        gl.uniformMatrix4fv(g_u_inversetranspose_ref, false, cloudInverseTranspose.elements)

        // Use flat lighting for the clouds with a white/light blue color
        gl.uniform1i(g_u_flatlighting_ref, true)
        gl.uniform3fv(g_u_flatcolor_ref, [0.9, 0.95, 1.0]) // Light blue/white for clouds

        // Draw the cloud model
        gl.drawArrays(gl.TRIANGLES, cloudVertexOffset, cloudMesh.length / 3)

        // Update offset for the next cloud
        cloudVertexOffset += cloudMesh.length / 3
    }

    // the grid has a constant identity matrix for model and world
    // world includes our Y offset
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(0, GRID_Y_OFFSET, 0).elements)
    gl.uniform3fv(g_u_flatcolor_ref, [0, 0.7, 0.3])

    // use flat green lighting for our grid
    gl.uniform1i(g_u_flatlighting_ref, true)
    gl.uniform3fv(g_u_flatcolor_ref, [0, 0.7, 0.3])

    // draw the grid
    gl.drawArrays(gl.LINES, cloudVertexOffset, g_gridMesh.length / 3)

    // draw the light source as a white cube
    gl.uniform3fv(g_u_flatcolor_ref, [1, 1, 1])
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().scale(0.1, 0.1, 0.1).elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().translate(...g_lightPosition).elements)
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
 * Helper function to build a grid mesh (without colors)
 * Returns these results as an array
 */
function buildGridMesh(grid_row_spacing, grid_column_spacing) {
    var mesh = []

    // Construct the rows
    for (var x = -GRID_X_RANGE; x < GRID_X_RANGE; x += grid_row_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(x, 0, -GRID_Z_RANGE)
        mesh.push(x, 0, GRID_Z_RANGE)
    }

    // Construct the columns extending "outward" from the camera
    for (var z = -GRID_Z_RANGE; z < GRID_Z_RANGE; z += grid_column_spacing) {
        // two vertices for each line
        // one at -Z and one at +Z
        mesh.push(-GRID_X_RANGE, 0, z)
        mesh.push(GRID_X_RANGE, 0, z)
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

