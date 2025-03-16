// Last edited by Dietrich Geisler 2024

const VSHADER_SOURCE = `
    uniform vec3 u_Offset;
    attribute vec3 a_Position;
    void main() {
        vec3 pos = a_Position + u_Offset; // first calculate a vec3 addition
        gl_Position = vec4(pos, 1.); // assign a vec4 with a 1.0 at the end
    }
`

const FSHADER_SOURCE = `
    void main() {
        // Every pixel gets the same color
        gl_FragColor = vec4(0.0, 1.0, 0.5, 1.0);
    }
`

// global hooks for updating data
var gl
var g_vertex_count
var g_uOffset_ref

// min offset
var MIN_X = -.5
var MAX_X = .5
var MIN_Y = 0
var MAX_Y = -.5

function main() {

    // Listen for slider change
    slider_input = document.getElementById('alpha')
    slider_input.addEventListener('input', (event) => {
        updateOffset(event.target.value);
    });

    canvas = document.getElementById('canvas');

    // Get the rendering context for WebGL
    gl = getWebGLContext(canvas, true);
    if (!gl) {
        console.log('Failed to get the rendering context for WebGL');
        return;
    }

    // Initialize GPU's vertex and fragment shaders programs
    if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
        console.log('Failed to intialize shaders.');
        return;
    }
    
    // Setup our vertices for a simple triangle
    var vertices = new Float32Array([
        -0.3, -0.3, 0.0,
        -0.3, 0.3, 0.0,
        0.3, -0.3, 0.0,
    ])
    g_vertex_count = 3 // The number of vertices

    // reference to the offset
    g_uOffset_ref = gl.getUniformLocation(gl.program, 'u_Offset');

    // Send our vertices to the GPU
    var error = initVertexBuffers(gl, vertices)
    if (error == 1) {
        console.log('Failed to load vertices into the GPU')
        return
    }

    updateOffset(0)
}

function initVertexBuffers(gl, vertices) {

    // get the VBO handle
    var VBOloc = gl.createBuffer();
    if (!VBOloc) {
        console.log('Failed to create the vertex buffer object');
        return -1;
    }

    // In the GPU, indicate the VBO as the location we are writing to
    gl.bindBuffer(gl.ARRAY_BUFFER, VBOloc);
    // COPY data from Javascript 'vertices' array into VBO in the GPU:
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    // Set up 'attributes' -- the Vertex and Shader vars that get filled from VBO:
    var a_PositionID = gl.getAttribLocation(gl.program, 'a_Position');
    if (a_PositionID < 0) {
        console.log('Failed to get the storage location of a_Position');
        return -1;
    }

    // Set how the GPU fills the a_Position variable with data from the GPU 
    gl.vertexAttribPointer(a_PositionID, 3, gl.FLOAT, false, 0, 0);

    // Enable the GPU to fill the a_Position variable from the VBO.
    gl.enableVertexAttribArray(a_PositionID)

    return 0;
}

function updateOffset(amount) {
    label = document.getElementById('sliderLabel')
    label.textContent = `alpha: ${amount}, X : [${MIN_X}, ${MAX_X}], Y : [${MIN_Y}, ${MAX_Y}]`
    var interpX = amount * (MAX_X - MIN_X) + MIN_X
    var interpY = amount * (MAX_Y - MIN_Y) + MIN_Y
    gl.uniform3fv(g_uOffset_ref, [interpX, interpY, 0])

    // Clear the canvas with a black background
    gl.clearColor(0.0, 0.0, 0.0, 1.0)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.drawArrays(gl.TRIANGLES, 0, g_vertex_count)
}