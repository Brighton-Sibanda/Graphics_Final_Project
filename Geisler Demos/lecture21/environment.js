// Last edited by Dietrich Geisler 2025

// references to the GLSL programs we need to load
var g_vshader
var g_fshader

// references to general information
var g_canvas
var gl
var g_lastFrameMS
var g_texturePointer

// GLSL uniform references
var g_u_model_ref
var g_u_world_ref
var g_u_camera_ref
var g_u_projection_ref
var g_u_texture_ref

// our usual matrices
var g_modelMatrix
var g_worldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at the center of the world
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// global hooks to our loaded images
var g_skyPosX
var g_skyPosY
var g_skyPosZ
var g_skyNegX
var g_skyNegY
var g_skyNegZ

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight

// Unit cube mesh, centered around 0
// Importantly, this cube faces "inwards"
const CUBE_MESH = [
    // front face
    1, 1, 1,
    -1, -1, 1,
    -1, 1, 1,

    1, 1, 1,
    1, -1, 1,
    -1, -1, 1,

    // back face
    1, 1, -1,
    -1, 1, -1,
    -1, -1, -1,

    1, 1, -1,
    -1, -1, -1,
    1, -1, -1,

    // right face
    1, 1, 1,
    1, 1, -1,
    1, -1, -1,

    1, 1, 1,
    1, -1, -1,
    1, -1, 1,

    // left face
    -1, 1, 1,
    -1, -1, -1,
    -1, 1, -1,

    -1, 1, 1,
    -1, -1, 1,
    -1, -1, -1,

    // top face
    1, 1, 1,
    -1, 1, -1,
    1, 1, -1,

    1, 1, 1,
    -1, 1, 1,
    -1, 1, -1,

    // bottom face
    1, -1, 1,
    1, -1, -1,
    -1, -1, -1,

    1, -1, 1,
    -1, -1, -1,
    -1, -1, 1,
]

// updated by hand from our previous tex mapping to get an "inward" cube
const CUBE_TEX_MAPPING = [
    // front face
    1, 0,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // back face
    0, 0,
    1, 0,
    1, 1,
    0, 0,
    1, 1,
    0, 1,

    // right face
    0, 0,
    1, 0,
    1, 1,
    0, 0,
    1, 1,
    0, 1,

    // left face
    1, 0,
    0, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,

    // top face
    1, 1,
    0, 0,
    1, 0,
    1, 1,
    0, 1,
    0, 0,

    // bottom face
    1, 0,
    1, 1,
    0, 1,
    1, 0,
    0, 1,
    0, 0,
]

// The size in bytes of a floating point
const FLOAT_SIZE = 4

function main() {
    // Setup key presses and releases
    setupKeyBinds()

    g_canvas = document.getElementById('canvas')

    // Get the rendering context for WebGL
    gl = getWebGLContext(g_canvas, true)
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL')
        return
    }

    // We will call this at the end of most main functions from now on
    loadOBJFiles()
}

/*
 * Helper function to load OBJ files in sequence
 * For much larger files, you may are welcome to make this more parallel
 * I made everything sequential for this class to make the logic easier to follow
 */
async function loadOBJFiles() {
    // open our OBJ file(s)
    data = await fetch('./resources/teapot.obj').then(response => response.text()).then((x) => x)
    g_teapotMesh = []
    // read the obj mesh
    readObjFile(data, g_teapotMesh)

    // load our GLSL files before rendering
    loadImageFiles()
}

/*
 * Helper function to _synchronously_ load image files
 * This can make you quite sad the first time loading an image...
 * But for this class it's "good enough"
 * Feel free to make this asynchronous of course
 */
async function loadImageFiles() {
    g_skyPosX = new Image()
    g_skyPosY = new Image()
    g_skyPosZ = new Image()
    g_skyNegX = new Image()
    g_skyNegY = new Image()
    g_skyNegZ = new Image()
    g_skyPosX.src = "resources/yokohama/posx.jpg"
    g_skyPosY.src = "resources/yokohama/posy.jpg"
    g_skyPosZ.src = "resources/yokohama/posz.jpg"
    g_skyNegX.src = "resources/yokohama/negx.jpg"
    g_skyNegY.src = "resources/yokohama/negy.jpg"
    g_skyNegZ.src = "resources/yokohama/negz.jpg"
    await g_skyPosX.decode()
    await g_skyPosY.decode()
    await g_skyPosZ.decode()
    await g_skyNegX.decode()
    await g_skyNegY.decode()
    await g_skyNegZ.decode()
    
    loadGLSLFiles()
}
    
async function loadGLSLFiles() {
    g_vshader = await fetch('./environment.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./environment.frag').then(response => response.text()).then((x) => x)

    // wait until everything is loaded before rendering
    startRendering()
}

function startRendering() {
    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, g_vshader, g_fshader)) {
        console.log('Failed to intialize shaders.')
        return
    }

    // initialize the VBO with grid information / send data to the GPU
    var data = CUBE_MESH.concat(CUBE_TEX_MAPPING)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Set our pointers
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

    // Setup matrices for our _big_ cube
    g_modelMatrix = new Matrix4().scale(10, 10, 10)
    g_worldMatrix = new Matrix4()

    // Initially place the camera facing some arbitrary direction
    g_cameraDistance = 1.0
    g_cameraAngle = 0
    g_cameraHeight = 0

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 100)

    // Setup 6 textures, one for each face
    g_texturePointerPosX = gl.createTexture()
    g_texturePointerPosY = gl.createTexture()
    g_texturePointerPosZ = gl.createTexture()
    g_texturePointerNegX = gl.createTexture()
    g_texturePointerNegY = gl.createTexture()
    g_texturePointerNegZ = gl.createTexture()

    // Set information for each of these texture pointers
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosX)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosX)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosY)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosY)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosZ)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosZ)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegX)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegX)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegY)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegY)
    gl.generateMipmap(gl.TEXTURE_2D)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegZ)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegZ)
    gl.generateMipmap(gl.TEXTURE_2D)

    // Enable culling and depth
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    tick()
}

// extra constants for cleanliness
const ROTATION_SPEED = .05
const CAMERA_SPEED = .003
const CAMERA_ROT_SPEED = .1

// function to apply all the logic for a single frame tick
function tick() {
    // time since the last frame
    var deltaTime

    // calculate deltaTime
    var current_time = Date.now()
    deltaTime = current_time - g_lastFrameMS
    g_lastFrameMS = current_time

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

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Calculate the camera position from our angle and height
    // we get to use a bit of clever 2D rotation math
    // note that we can only do this because we're "fixing" our plane of motion
    // if we wanted to allow arbitrary rotation, we would want quaternions!
    camX = Math.cos(Math.PI * g_cameraAngle / 180)
    camY = g_cameraHeight
    camZ = Math.sin(Math.PI * g_cameraAngle / 180)
    var cameraPosition = new Vector3([camX, camY, camZ])
    cameraPosition.normalize()
    
    // calculate distance and turn into an array for matrix entry
    var cameraPositionArray = [
        cameraPosition.elements[0] * g_cameraDistance,
        cameraPosition.elements[1] * g_cameraDistance,
        cameraPosition.elements[2] * g_cameraDistance
    ]

    // Build a new lookat matrix each frame
    cameraMatrix = new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Setup our cube
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // draw each face with a different texture, one by one
    // getting the order of textures right is annoying
    // but you can get it pretty quick with just trying it and correcting
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosZ)
    gl.uniform1i(g_u_texture_ref, g_texturePointerPosZ)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegZ)
    gl.uniform1i(g_u_texture_ref, g_texturePointerNegZ)
    gl.drawArrays(gl.TRIANGLES, 6, 6)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosX)
    gl.uniform1i(g_u_texture_ref, g_texturePointerPosX)
    gl.drawArrays(gl.TRIANGLES, 12, 6)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegX)
    gl.uniform1i(g_u_texture_ref, g_texturePointerNegX)
    gl.drawArrays(gl.TRIANGLES, 18, 6)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerPosY)
    gl.uniform1i(g_u_texture_ref, g_texturePointerPosY)
    gl.drawArrays(gl.TRIANGLES, 24, 6)
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointerNegY)
    gl.uniform1i(g_u_texture_ref, g_texturePointerNegY)
    gl.drawArrays(gl.TRIANGLES, 30, 6)
}

/*
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
    // Start movement when the key starts being pressed
    document.addEventListener('keydown', function(event) {
        if (event.key == 'w') {
			g_movingUp = true
		}
        else if (event.key == 's') {
			g_movingDown = true
		}
        else if (event.key == 'a') {
			g_movingLeft = true
		}
        else if (event.key == 'd') {
			g_movingRight = true
		}
	})

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key == 'w') {
			g_movingUp = false
		}
        else if (event.key == 's') {
			g_movingDown = false
		}
        else if (event.key == 'a') {
			g_movingLeft = false
		}
        else if (event.key == 'd') {
			g_movingRight = false
		}
	})
}

// Helper to construct colors
// makes every triangle a slightly different shade of blue
function buildColorAttributes(vertexCount) {
    var colors = []
    for (var i = 0; i < vertexCount / 3; i++) {
        // three vertices per triangle
        for (var vert = 0; vert < 3; vert++) {
            var shade = (i * 3) / vertexCount
            colors.push(shade, shade, 1.0)
        }
    }

    return colors
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