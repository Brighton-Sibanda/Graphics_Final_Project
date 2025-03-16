// Based on https://webglfundamentals.org/webgl/lessons/webgl-skybox.html
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

// whether to draw the skybox or a "regular mode"
uniform bool u_DrawSkybox;

attribute vec3 a_Position;
attribute vec3 a_Color;
varying vec3 v_Position;
varying vec3 v_Color;
void main() {
    if (u_DrawSkybox) {
        // the position is exactly our "default" square, with a z fixed to .999
        // in other words, draw the square as far away as possible
        gl_Position = vec4(a_Position.xy, .999, 1.0);
    }
    else {
        gl_Position = u_Projection * u_Camera * u_World 
            * u_Model * vec4(a_Position, 1.0);
    }
    
    v_Position = a_Position;
    v_Color = a_Color;
}