// Last edited by Dietrich Geisler 2024

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
var g_u_texture_ref

// our usual matrices
var g_modelMatrix
var g_worldMatrix
var g_cameraMatrix
var g_projectionMatrix

// global hook to our loaded image
var g_cubeImage

// hook to our texture buffer location
var g_texturePointer

// the current axis of rotation
var g_rotation_axis

// Unit cube mesh, size 1, oriented around zero
const CUBE_MESH = [
    // front face
    1.0, 1.0, 1.0,
    -1.0, 1.0, 1.0,
    -1.0, -1.0, 1.0,

    1.0, 1.0, 1.0,
    -1.0, -1.0, 1.0,
    1.0, -1.0, 1.0,

    // back face
    1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0,
    -1.0, 1.0, -1.0,

    1.0, 1.0, -1.0,
    1.0, -1.0, -1.0,
    -1.0, -1.0, -1.0,

    // right face
    1.0, 1.0, 1.0,
    1.0, -1.0, -1.0,
    1.0, 1.0, -1.0,

    1.0, 1.0, 1.0,
    1.0, -1.0, 1.0,
    1.0, -1.0, -1.0,

    // left face
    -1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0,
    -1.0, -1.0, -1.0,

    -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0,
    -1.0, -1.0, 1.0,

    // top face
    1.0, 1.0, 1.0,
    1.0, 1.0, -1.0,
    -1.0, 1.0, -1.0,

    1.0, 1.0, 1.0,
    -1.0, 1.0, -1.0,
    -1.0, 1.0, 1.0,

    // bottom face
    1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0,
    1.0, -1.0, -1.0,

    1.0, -1.0, 1.0,
    -1.0, -1.0, 1.0,
    -1.0, -1.0, -1.0,
]

const CUBE_TEX_MAPPING = [
    // front face
    1, 1,
    0, 1,
    0, 0,
    1, 1,
    0, 0,
    1, 0,

    // back face
    1, 0,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // right face
    0, 1,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
    1, 0,

    // left face
    1, 1,
    0, 1,
    0, 0,
    1, 1,
    0, 0,
    1, 0,

    // top face
    1, 0,
    1, 1,
    0, 1,
    1, 0,
    0, 1,
    0, 0,

    // bottom face
    1, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,
]

// We're using triangles, so our primitives each have 3 elements
const TRIANGLE_SIZE = 3

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We will call this at the end of most main functions from now on
    loadImageFiles()
}

/*
 * Helper function to _synchronously_ load image files
 * This can make you quite sad the first time loading an image...
 * But for this class it's "good enough"
 * Feel free to make this asynchronous of course
 */
async function loadImageFiles() {
    g_cubeImage = new Image()
    g_cubeImage.src = "resources/small.png"
    await g_cubeImage.decode()
    
    loadGLSLFiles()
}

async function loadGLSLFiles() {
    g_vshader = await fetch('./texture_small.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./texture_small.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // initialize the VBO
    var data = CUBE_MESH.concat(CUBE_TEX_MAPPING)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec(3, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(2, 'a_TexCoord', 0, CUBE_MESH.length * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_texture_ref = gl.getUniformLocation(gl.program, 'u_Texture')

    // Setup reasonable "defaults"
    g_modelMatrix = new Matrix4().scale(.5, .5, .5)
    g_worldMatrix = new Matrix4().translate(0, 0, -1)
    g_cameraMatrix = new Matrix4()
    g_projectionMatrix = new Matrix4().setOrtho(-1, 1, -1, 1, .1, 100)

    // https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html
    // Create a texture and bind it to the gl texture slot thingy
    var g_texturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointer)

    // Set our new texture as the target of u_Texture
    gl.uniform1i(g_u_texture_ref, g_texturePointer)

    // Bind the texture to the u_Texture slot
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cubeImage)

    // Set parameters of that texture
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)

    // Enable culling and depth testing
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()
    g_rotationAxis = [0, 0, 0]

    // Make sure we have a defined rotation
    updateRotation()

    tick()
}

// extra constants for cleanliness
var ROTATION_SPEED = .05

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
    g_modelMatrix.concat(new Matrix4().setRotate(angle, ...g_rotationAxis))

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, g_cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, CUBE_MESH.length / TRIANGLE_SIZE)
}

// Event to change which rotation is selected
function updateRotation() {
    var rotateX = document.getElementById('rotateX')
    var rotateY = document.getElementById('rotateY')
    var rotateZ = document.getElementById('rotateZ')

    g_rotationAxis[0] = Number(rotateX.checked)
    g_rotationAxis[1] = Number(rotateY.checked)
    g_rotationAxis[2] = Number(rotateZ.checked)
}

/*
 * Initialize the VBO with the provided data
 * Assumes we are going to have "static" (unchanging) data
 */
function initVBO(data) {
    // get the VBO handle
    var VBOloc = gl.createBuffer()
    if (!VBOloc) {
        console.log('Failed to create the vertex buffer object')
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