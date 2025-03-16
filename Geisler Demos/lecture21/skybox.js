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
var g_u_skybox_ref
var g_u_drawSkybox_ref
var g_u_cameraProjectionInverse_ref

// usual model/world matrices
var g_modelMatrix
var g_worldMatrix
var g_projectionMatrix

// keep track of the camera position, always looking at the teapot
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// Mesh definitions
var g_teapotMesh

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

// We just need a square mesh to put our texture on!
const SQUARE_MESH = [
    1, 1, 1,
    -1, 1, 1,
    -1, -1, 1,
    1, 1, 1,
    -1, -1, 1,
    1, -1, 1,
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
    g_vshader = await fetch('./skybox.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./skybox.frag').then(response => response.text()).then((x) => x)

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
    // note that we duplicate the cube mesh to "fill in" colors
    var teapotColors = buildColorAttributes(g_teapotMesh.length / 3)
    var data = SQUARE_MESH.concat(g_teapotMesh).concat(SQUARE_MESH).concat(teapotColors)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Set our pointers
    if (!setupVec(3, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(3, 'a_Color', 0, (SQUARE_MESH.length + g_teapotMesh.length) * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_skybox_ref = gl.getUniformLocation(gl.program, 'u_Skybox')
    g_u_drawSkybox_ref = gl.getUniformLocation(gl.program, 'u_DrawSkybox')
    g_u_cameraProjectionInverse_ref = gl.getUniformLocation(gl.program, 'u_CameraProjectionInverse')

    // Setup matrices for the teapot
    g_modelMatrix = new Matrix4().scale(.002, .002, -.002)
    g_worldMatrix = new Matrix4()

    // Initially place the camera in "front" and above the teapot a bit
    g_cameraDistance = 0.5
    g_cameraAngle = 90
    g_cameraHeight = .2

    // Setup a "reasonable" perspective matrix
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 500)

    // Setup our cube map
    // https://webglfundamentals.org/webgl/lessons/webgl-cube-maps.html
    g_texturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_CUBE_MAP, g_texturePointer)

    // Bind a texture to each cube map slot
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosX)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosY)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_POSITIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyPosZ)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_X, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegX)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Y, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegY)
    gl.texImage2D(gl.TEXTURE_CUBE_MAP_NEGATIVE_Z, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_skyNegZ)

    // Set parameters of that texture
    gl.generateMipmap(gl.TEXTURE_CUBE_MAP)

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

    // rotate the teapot constantly around the given axis (of the model)
    angle = ROTATION_SPEED * deltaTime
    g_worldMatrix = new Matrix4().setRotate(angle, 0, 1, 0).concat(g_worldMatrix)

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

    // Calculate the inverse of our camera + projection for the skybox
    var cameraProjectionInverse = new Matrix4(g_projectionMatrix).multiply(cameraMatrix)
    cameraProjectionInverse.invert()

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)

    // Setup the skybox
    gl.uniformMatrix4fv(g_u_model_ref, false, new Matrix4().elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, new Matrix4().elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)
    gl.uniformMatrix4fv(g_u_cameraProjectionInverse_ref, false, cameraProjectionInverse.elements)

    // Set our texture to our cubemap
    gl.uniform1i(g_u_skybox_ref, g_texturePointer)

    // Use the skybox draw option and draw arrays
    gl.uniform1i(g_u_drawSkybox_ref, 1)
    gl.drawArrays(gl.TRIANGLES, 0, SQUARE_MESH.length / 3)

    // Setup the teapot
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // don't draw a skybox, draw a teapot
    gl.uniform1i(g_u_drawSkybox_ref, 0)
    gl.drawArrays(gl.TRIANGLES, SQUARE_MESH.length / 3, g_teapotMesh.length / 3)
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