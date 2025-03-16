attribute vec3 a_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

attribute vec2 a_TexCoord;

uniform float u_TexelWidth;
uniform float u_TexelHeight;

// we need a bunch of slightly-offset data
// note that this needs to have been calculated in the vertex shader for rasterization
varying vec2 v_Offset;
varying vec2 v_TexCoord;
varying vec2 v_TexLeft;
varying vec2 v_TexRight;
varying vec2 v_TexUp;
varying vec2 v_TexDown;
void main() {
    gl_Position = u_Projection * u_Camera * u_World 
        * u_Model * vec4(a_Position, 1.0);

    v_TexCoord = a_TexCoord;
    v_TexLeft = a_TexCoord + vec2(-u_TexelWidth, 0);
    v_TexRight = a_TexCoord + vec2(u_TexelWidth, 0);
    v_TexDown = a_TexCoord + vec2(0, u_TexelHeight);
    v_TexUp = a_TexCoord + vec2(0, -u_TexelHeight);
}