attribute vec3 a_Position;
uniform mat4 u_Model;
uniform mat4 u_World;
uniform mat4 u_Camera;
uniform mat4 u_Projection;

uniform vec3 u_Light;
attribute vec3 a_Normal;
attribute vec2 a_TexCoord;
varying vec3 v_Position;
varying vec3 v_Normal;
varying vec2 v_TexCoord;
void main() {
    gl_Position = u_Projection * u_Camera * u_World 
        * u_Model * vec4(a_Position, 1.0);
    
    // rasterize our texcoord, normal, and position information
    v_TexCoord = a_TexCoord * 0.5;
    v_Normal = a_Normal;
    v_Position = a_Position;
}