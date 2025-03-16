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

// keep track of the camera position, always looking at the world center
var g_cameraDistance
var g_cameraAngle
var g_cameraHeight

// our usual matrices
var g_modelMatrix
var g_worldMatrix
var g_cameraMatrix
var g_projectionMatrix

// global hook to our loaded obj file/image
var g_cottageImage
var g_cottageMesh
var g_cottageNormals
var g_cottageTexCoords

// hook to our texture buffer location
var g_texturePointer

// Key states
var g_movingUp
var g_movingDown
var g_movingLeft
var g_movingRight
var g_movingForward
var g_movingBackward

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
    g_cubeImage.src = "resources/85-cottage_obj/cottage_diffuse_upside_down.png"
    await g_cubeImage.decode()
    
    loadOBJFiles()
}

/*
 * Helper function to load OBJ files in sequence
 * For much larger files, you may are welcome to make this more parallel
 * I made everything sequential for this class to make the logic easier to follow
 */
async function loadOBJFiles() {
    // open our OBJ file(s)
    data = await fetch('resources/85-cottage_obj/cottage_tri.obj').then(response => response.text()).then((x) => x)
    g_cottageMesh = []
    // note that normals are unused in this demo
    // but it's nice to include them as an example of how you would get them
    g_cottageNormals = []
    g_cottageTexCoords = []
    // read the obj mesh _and_ normals
    readObjFile(data, g_cottageMesh, g_cottageNormals, g_cottageTexCoords)

    // load our GLSL files before rendering
    loadGLSLFiles()
}

async function loadGLSLFiles() {
    g_vshader = await fetch('./texturing_demo.vert').then(response => response.text()).then((x) => x)
    g_fshader = await fetch('./texturing_demo.frag').then(response => response.text()).then((x) => x)

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
    var data = g_cottageMesh.concat(g_cottageTexCoords)
    if (!initVBO(new Float32Array(data))) {
        return
    }

    // Send our vertex data to the GPU
    if (!setupVec(3, 'a_Position', 0, 0)) {
        return
    }
    if (!setupVec(2, 'a_TexCoord', 0, g_cottageMesh.length * FLOAT_SIZE)) {
        return
    }

    // Get references to GLSL uniforms
    g_u_model_ref = gl.getUniformLocation(gl.program, 'u_Model')
    g_u_world_ref = gl.getUniformLocation(gl.program, 'u_World')
    g_u_camera_ref = gl.getUniformLocation(gl.program, 'u_Camera')
    g_u_projection_ref = gl.getUniformLocation(gl.program, 'u_Projection')
    g_u_texture_ref = gl.getUniformLocation(gl.program, 'u_Texture')

    // Setup reasonable "defaults"
    g_modelMatrix = new Matrix4().scale(.1, .1, .1)
    g_worldMatrix = new Matrix4().translate(0, 0, 0)
    g_projectionMatrix = new Matrix4().setPerspective(90, 1, .1, 100)

    // https://webglfundamentals.org/webgl/lessons/webgl-3d-textures.html
    // Create a texture and bind it to the gl texture slot thingy
    var g_texturePointer = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, g_texturePointer)

    // Set our new texture as the target of u_Texture
    gl.uniform1i(g_u_texture_ref, g_texturePointer)

    // Bind the texture to the u_Texture slot
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, g_cubeImage)

    // Generate a mipmap for this texture
    gl.generateMipmap(gl.TEXTURE_2D)

    // Enable culling and depth testing
    gl.enable(gl.CULL_FACE)
    gl.enable(gl.DEPTH_TEST)

    // Setup for ticks
    g_lastFrameMS = Date.now()

    // Initialize our data
    g_cameraDistance = 5
    g_cameraAngle = 100
    g_cameraHeight = 1.5

    tick()
}

// extra constants for cleanliness
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

    updateCameraMovement(deltaTime)

    draw()

    requestAnimationFrame(tick, g_canvas)
}

// draw to the screen on the next frame
function draw() {
    // Update with our global transformation matrices
    gl.uniformMatrix4fv(g_u_model_ref, false, g_modelMatrix.elements)
    gl.uniformMatrix4fv(g_u_world_ref, false, g_worldMatrix.elements)
    cameraMatrix = calculateCameraMatrix()
    gl.uniformMatrix4fv(g_u_camera_ref, false, cameraMatrix.elements)
    gl.uniformMatrix4fv(g_u_projection_ref, false, g_projectionMatrix.elements)

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, g_cottageMesh.length / 3)
}

// Calculate the camera position from our angle and height
// we get to use a bit of clever 2D rotation math
// note that we can only do this because we're "fixing" our plane of motion
// if we wanted to allow arbitrary rotation, we would want quaternions!
function calculateCameraMatrix() {
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

    return new Matrix4().setLookAt(...cameraPositionArray, 0, 0, 0, 0, 1, 0)
}

// tick helper to update the camera
function updateCameraMovement(deltaTime) {
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
        g_cameraDistance -= CAMERA_SPEED * deltaTime
        // we don't want to hit a distance of 0
        g_cameraDistance = Math.max(g_cameraDistance, 1.0)
    }
    if (g_movingBackward) {
        g_cameraDistance += CAMERA_SPEED * deltaTime
    }
}

/*
 * Helper function to setup key binding logic
 */
function setupKeyBinds() {
    // Start movement when the key starts being pressed
    document.addEventListener('keydown', function(event) {
        if (event.key == 'r') {
			g_movingUp = true
		}
        else if (event.key == 'f') {
			g_movingDown = true
		}
        else if (event.key == 'a') {
			g_movingLeft = true
		}
        else if (event.key == 'd') {
			g_movingRight = true
		}
		else if (event.key == 'w') {
			g_movingForward = true
		}
		else if (event.key == 's') {
			g_movingBackward = true
		}
	})

    // End movement on key release
    document.addEventListener('keyup', function(event) {
        if (event.key == 'r') {
			g_movingUp = false
		}
        else if (event.key == 'f') {
			g_movingDown = false
		}
        else if (event.key == 'a') {
			g_movingLeft = false
		}
        else if (event.key == 'd') {
			g_movingRight = false
		}
		else if (event.key == 'w') {
			g_movingForward = false
		}
		else if (event.key == 's') {
			g_movingBackward = false
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