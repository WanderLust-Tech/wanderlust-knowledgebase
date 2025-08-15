# Sandbox Architecture

Security is one of Chromium's most important goals. The key to security is to understand that after we have fully understood the behavior of the system under all possible input combinations, we can truly guarantee that the system is secure. For a codebase as large and diverse as Chromium, it's nearly impossible to reason about the combination of possible behaviors of its various parts. The goal of the sandbox is to provide the guarantee that no matter what is entered, what a piece of code can or cannot ultimately do.

Sandboxing leverages the security provided by the operating system to allow the execution of code that cannot make persistent changes to the computer or access constantly changing information. The architecture and specific guarantees provided by the sandbox depend on the operating system. This document covers the Windows implementation with a general design. Linux implementations and OSX implementations are also described here.

If you don't want to read this entire document, you can read [the Sandbox FAQ](http://yehe.isd.com/column/support-plan/article-edit/Sandbox_FAQ.md). Sandbox-protected and unprotected content can also be found in the FAQ.

## Design Principles  

-   **Don't reinvent the wheel: It's** tempting to extend the operating system kernel with a better security model. But don't do it. Let the operating system apply its security policy on the objects it controls. On the other hand, it is possible to create application-level objects (abstractions) with a custom security model.
-   **Principle of least privilege**: This should be used both for sandbox code and code that controls the sandbox. In other words, even if used to not elevate privileges to superuser, the sandbox needs to be able to work.
-   **Assume that the sandboxed code is malicious**: for threat modeling purposes, we think that once the execution path of the code in the sandbox crosses the early call of some main() function, then it is harmful (that is, it will run harmful code), which in practice can happen when the first external input is received, or before entering the main loop.
-   **Sensitive**: Non-malicious code will not attempt to access resources that it cannot obtain. In this case, the performance impact of the sandbox should be close to zero. A little performance penalty is necessary when sensitive resources need to be accessed in a controlled manner. This is a common example of something that is appropriate for operating system security.
-   **Emulation is not secure**: Emulation and virtual machine scenarios by themselves do not provide security. Sandboxes do not rely on code emulation, or code conversion, or code fixes for security purposes. Sandbox Windows architecture

The Windows Sandbox is a sandbox that is available only in user mode. There are no special kernel-mode drivers, and users do not need to become administrators in order for the sandbox to run correctly. Sandbox is designed with both 32-bit and 64-bit processes, and all os-operating system versions between Windows 7 and Windows 10 have been tested.

Sandboxes operate at the process level with granularity. Anything that needs to be sandboxed needs to be put into a separate process. There are two processes for minimizing a sandbox configuration: a permission controller that is called a broker, and one or more sandboxed processes called targets. These two words have these two precise connotations throughout the documentation and code. A sandbox is a static library that must be linked to broker and target executables.

## Windows Sandbox Model  
### Broker vs. Target  

### Broker process
In Chromium, the broker always browses the process. Broker, broadly known, is a permission controller, an administrator of sandbox process activity. The responsibilities of the broker process are:

1.  Specifies the policy in each target process
2.  Build the target process
3.  Maintain the Sandbox Policy Engine service
4.  Maintain the Sandbox Intercept Manager
5.  Maintain sandboxed IPC services (communication with target processes)
6.  Performs the actions allowed by the policy on behalf of the target process.

The broker should always live longer than all the target processes it generates. A sandboxed IPC is a low-level mechanism (unlike the Chromium IPC mechanism) that is evaluated by the policy. The calls allowed by the policy are executed by the broker, and the result is returned to the target process via the same IPC. The Intercept Manager is a patch for Windows API calls that should be forwarded to brokers via IPC.

### The target process

In Chromium, the renderer is always a target process, unless the browsing process is specified with the --no-sandbox command-line argument. The target process maintains all the code that will be allowed in the sandbox, as well as the clients of the sandbox infrastructure:

1.  All code is sandboxed
2.  Sandboxed IPC client
3.  Sandbox policy engine client
4.  Sandbox interception

Articles 2, 3, and 4 are part of the sandbox library and are associated with code that needs to be sandboxed.

Interceptors (also known as hooks) are Windows API calls that are forwarded through the sandbox. The API call is reissued by the broker and returns the result or simply terminates the call. The interceptor + IPC mechanism does not provide security; Its purpose is to provide compatibility when the code in the sandbox cannot be modified due to sandbox limitations. In order to save unnecessary IPC, the process policy in target is also evaluated before making an IPC call, although this is not used as a security guarantee, but it is only a speed optimization.

Expect most of the plugin to run in the target process in the future.

![](https://ask.qcloudimg.com/http-save/yehe-1137887/kkyh3qnc4b.png?imageView2/2/w/1620)

### Core OS Primitives  
### The target process

In Chromium, the renderer is always a target process, unless the browsing process is specified with the --no-sandbox command-line argument. The target process maintains all the code that will be allowed in the sandbox, as well as the clients of the sandbox infrastructure:

1.  All code is sandboxed
2.  Sandboxed IPC client
3.  Sandbox policy engine client
4.  Sandbox interception

Articles 2, 3, and 4 are part of the sandbox library and are associated with code that needs to be sandboxed.

Interceptors (also known as hooks) are Windows API calls that are forwarded through the sandbox. The API call is reissued by the broker and returns the result or simply terminates the call. The interceptor + IPC mechanism does not provide security; Its purpose is to provide compatibility when the code in the sandbox cannot be modified due to sandbox limitations. In order to save unnecessary IPC, the process policy in target is also evaluated before making an IPC call, although this is not used as a security guarantee, but it is only a speed optimization.

Expect most of the plugin to run in the target process in the future.

![](https://ask.qcloudimg.com/http-save/yehe-1137887/kkyh3qnc4b.png?imageView2/2/w/1620)

## Sandbox limits

At its core, the sandbox relies on 4 mechanisms provided by Windows:

-   A qualified token
-   Windows work objects
-   Windows desktop object
-   Windows Vista and above: Integration layer

These mechanisms are quite efficient in protecting the operating system, the limitations of the operating system, and the data provided by the user, provided that:

-   All resources that can be secured have a better security descriptor than null. In other words, there are no critical resources that would have a bad security configuration.
-   The computer was not compromised by malware.
-   Third-party software cannot weaken system security.

\*\* Note: The specific measures above and the measures outside the kernel are described in the "Process Lightweighting" section below. \*\*

### token

One of the problems faced by other similar sandbox projects is how restrictive they should be so that tokens and jobs remain functional. In the Chromium sandbox, the most restrictive tokens for Windows XP are as follows:

**Normal group**

Login SID : Mandatory

All other SIDs: Deny only, Forced

**Restrict groups**

S-1-0-0 : Mandatory

**privilege**

not

As mentioned above, if the operating system grants such a token, it is almost impossible to find the resource that exists. As long as the disk root directory has non-empty security, even empty safe files cannot be accessed. In Vista, the most restrictive token is also like this, but it also includes labels with lower integrity levels. Chromium renderers typically use this token, which means that most of the resources used by the renderer process are already fetched by the browser, and their handles are copied to the renderer process.

Note that the token does not originate from an anonymous token or a guest token, it inherits from the user's token and is therefore associated with the user's sign-in. Therefore, any alternate audits owned by the system or [domain name](https://dnspod.cloud.tencent.com/) can still be used.

By design, sandbox tokens do not protect the following insecure resources:

-   Mounted FAT or FAT32 volumes: The security descriptor on them is validly empty. Malware running in targets can read and write this disk space because the malware can guess or eject their paths.
-   TCP/IP: The security of tcp/IP sockets in Windows 200 and Windows XP (but not in Vista) is valid null. This makes it possible for malicious code to send and receive network packets from any host.

More information about the Windows token object can be found in the reference \[02\] at the bottom.

### Job object

The target process also runs a job object. Using this Windows mechanism, some interesting global restrictions that do not own traditional objects or do not associate security descriptors can be enforced:

-   SystemParametersInfo() is prohibited from making system-wide modifications shared by the user, which can be used to switch mouse buttons or set screen savers to time out
-   It is forbidden to create or modify desktop objects
-   It is forbidden to modify user-shared display settings, such as resolution and primary display
-   Read and write to the clipboard is prohibited
-   Disable setting global Windows hooks (using SetWindowsHookEx())
-   Disable access to global atomic tables
-   Disables access to USER handles created outside the job object
-   Single-active process limit (child processes are not allowed)

The Chromium renderer allows with all these restrictions activated. Each renderer runs in its own job object. With job objects, sandboxes can (but not currently) avoid:

-   Overuse of CPU cycles
-   Excessive use of memory
-   Overuse of IO

Detailed information about Windows job objects can be found in the reference \[1\] at the bottom.

### Additional desktop objects

Tokens and job objects define a security boundary: that is, all processes have the same token, and all processes in the same job object are in the same security context. However. An incomprehensible fact is that applications on the same desktop that have windows are also in the same security context, because sending and receiving window messages is not subject to any security checks. Sending messages through desktop objects is not allowed. This is the source of the infamous "shatter" attack and the reason why services should not host windows on interactive desktops. The Windows desktop is a regular kernel object that can be created and then assigned a security descriptor.

In a standard Windows installation, at least two desktops are associated with an interactive window station, one is a regular (default) desktop and the other is a login desktop. The sandbox creates a third desktop associated with all target processes. This desktop is never visible or interactive, effectively isolating sandboxed processes so that they cannot spy on the user's interactions and send messages to Windows in more privileged environments.

The only advantage of an additional desktop object is that it uses close to 4MB of memory from an isolated pool, which may be more in Vista.

### Credit rating

Credit ratings are available in versions of Windows Vista and beyond. They don't define the boundaries of security in a strict way, but they do provide a kind of mandatory access control (MAC) and exist as the basis for the Microsoft IE sandbox.

Credit ratings are implemented by a special set of SIDs and ACL pairs, which represent five incremental levels: untrusted, low-level, intermediate, high-level, and systematic. If an object is at a higher credit rating than the request token, access to it is restricted. Credit ratings also implement user interface permission isolation, which applies credit rating rules to exchange window messages for different processes in the same desktop.

By default, tokens can read objects with high credit ratings, but cannot write. Most desktop applications run on a low credit rating (MI), while less trusted processes like IE Protected Mode and our own sandbox run on a low credit rating (LI). A token in a low credit rating mode can only access the following shared resources:

-   Read access to most files
-   Write access to %USER PROFILE, AppData, LocalLow directories
-   Read most of the registry
-   Write access to the HKEY\_CURRENT\_USER\\Software\\AppDataLow directory
-   Clipboard (copy and paste for some formats)
-   Remote Procedure Call (RPC)
-   TCP/IP Socket
-   Expose window messages via ChangeWindowMessageFilter
-   Share memory via LI tags
-   Has the li to initiate activation permissions to access the COM interface
-   Named pipes exposed by LI tags

You'll notice that the token attributes described earlier, the work objects, the additional desktop are more restrictive, and in fact hinder access to everything listed above. Therefore, the credit rating is more relaxed than other measures, but this can also be seen as a denial of defense-in-depth, and its use will not have a significant impact on performance or resource use.

More information on credit ratings can be found in the reference \[03\] at the bottom.

### Process lightweighting strategy

Most process lightweighting strategies can be applied to Targetget processes through the SetProcessMitigationPolicy method. The sandbox uses this API to set different policies for the target process to strengthen security features.

**To relocate an image:**

-   \>= Win8
-   Random Address Loading (ASLR) for all images in the process (must be supported by all images)

**The End of the Heap:**

-   \>= Win8
-   End the Windows heap occupation process

**Bottom-up ASLR:**

-   \>= Win8
-   Sets a random nether as the minimum user address for the process

**High entropy ASLR:**

-   \>= Win8
-   Add a random level to 1TB for bottom-up ASLR.

**Strict handle checking:**

-   \>= Win8
-   An exception is thrown immediately for malicious handle references

**Win32k .sys Lock:**

-   \>= Win8
-   ProcessSystemCallDisablePolicy, which allows selectively shutting down system calls available to the target process
-   The renderer process now sets this feature to DiskWin32kSystemCalls, which means that win32k .sys user-mode calls are no longer allowed. This greatly reduces the available kernel attacks from the renderer. Check [out here](https://docs.google.com/document/d/1gJDlk-9xkh6_8M_awrczWCaUuyr0Zd2TKjNBCiPO_G4) for more details.

**App** [**container**](https://cloud.tencent.com/product/tke?from=10680) **(Low Box Token):**

-   \>= Win8
-   In Windows, this is implemented by a Low Box Token at the kernel level, which is a stripped version with restrictive priority (usually only SeChangeNotifyPrivilege and SeIncreaseWorkingSetPrivilege), running at a low credit level, and this container is also implemented by a set of "capabilities" that can be mapped to what the process allows/denies to do (see [MSDN](https://msdn.microsoft.com/en-us/library/windows/apps/hh464936.aspx)). Get a more detailed description). From a sandbox perspective, the most interesting capability is to veto access to the network, and if the token is a Low Box Token, INTERNET\_CLIENT capability does not appear, a network check is performed.
-   So the sandbox adds Low Box-related attributes to the existing restriction tokens, and does not grant any additional network protection such as network access without the sandboxing process.

**To disable font loading:**

-   \>= Win10
-   ProcessFontDisablePolicy

**To disable remote device image loading:**

-   \>= Win10 TH2
-   ProcessImageLoadPolicy
-   Example: UNC path to a network resource

**To disable "Force Low Credit Rating" image loading:**

-   \>= Win10 TH2
-   ProcessImageLoadPolicy
-   Example: Temporary Internet file

**Disable additional child process creation:**

-   \>= Win10 TH2
-   If the job level < = JOB\_LIMITED\_USER, set the PROC\_THREAD\_ATTRIBUTE\_CHILD\_PROCESS\_POLICY to PROCESS\_CREATION\_CHILD\_PROCESS\_RESTRICTED with UpdateProcThreadAttribute().
-   This is an extra layer of defense that allows the job layer to be broken from the outside. \[Citation: [ticket](https://bugs.chromium.org/p/project-zero/issues/detail?id=213&redir=1), [Project Zero blog](http://googleprojectzero.blogspot.co.uk/2015/05/in-console-able.html).\]

### Other warnings

The operating system may have some bugs. Of interest are some bugs in the Windows API that allow routine security checks to be skipped. If such a bug exists, the malware is able to penetrate security restrictions, broker policies, and potentially compromise the computer. In a Windows environment, there is no practical way to avoid code in the sandbox calling system services.

In addition, third-party software, especially anti-virus solutions, may create new attack angles. The most troublesome thing is to inject applications into the dynamic link library in order to use some (often the system does not want to use) features. These dynamic link libraries are also injected into the sandbox process. At best, they produce failures and, in worst cases, potentially create backdoors for other processes or the file system itself, allowing carefully designed malware to escape the sandbox.


## Bootstrapping & Policy Rules  
## Sandbox policies

Apply real restrictions with target processes through policy settings. These policies are just a programming interface called by a broker, and they define restrictions and permissions. Four functions control this limitation, corresponding to four Windows mechanisms:

-   TargetPolicy::SetTokenLevel()
-   TargetPolicy::SetJobLevel()
-   TargetPolicy::SetIntegrityLevel()
-   TargetPolicy::SetDesktop()

The first three calls receive integer rank parameters from very strict to very loose, e.g. tokens have seven levels and jobs have five levels. Chromium renderers typically run the most restrictive mode of the four mechanisms. Finally, there are two desktop policies that can only be used to indicate whether a target process is running in an extra desktop object.

These limitations are coarse design because they affect all the protectable resources that the target can access, but sometimes we need finer granular resolution. The sandbox policy interface allows the broker to specify exceptions. One exception is the way to make a specific Windows API call in target, proxying it to a broker. The broker can check the parameters, reissue the call with different parameters, or reject the call altogether. In order to specify exceptions, a separate call is required: AddRule. The following rules for different Windows subsystems are now supported: _File_ Named Pipe _process creation_ Enlisted \* Synchronization objects

The specific form of each seed system varies, but usually the rules are triggered based on string patterns. For example, one possible file rule is:

```
AddRule(SUBSYS_FILES, FILES_ALLOW_READONLY, L"c:\\temp\\app_log\\d*.dmp")
```

This rule specifies the permissions that can be granted when a target process wants to open a file, as well as read-only permissions for files that match the string format; For example, c:\\temp\\app\_log\\domino.dmp is a file that satisfies the format above. Query header files to get a list of the most recently supported objects and behaviors.

Rules can only be added before each process is spawned, and cannot be modified when target is running, but different targets can have different rules.

## Target bootstrapping

Target does not start with the restrictions defined by the policy. They start with a token that is very close to the token owned by a regular user process. Because during process boot, the operating system loader accesses a large number of resources, most of which are unauthenticated and changeable at any time. In addition, most applications use the standard CRT provided by standard development tools, and after the process is guided, the CRT also needs to be initialized, at which point the inside of the CRT initialization becomes uncertified again.

Therefore, during the boot phase, the process actually uses two kinds of tokens: a lock token, which is also a process token, and an initial token, which is set as an impersonation token for the initial thread. In fact, the true SetTokenLevel definition is:

```
SetTokenLevel(TokenLevel initial, TokenLevel lockdown)
```

After all initialization operations are complete, main() or WinMain() will continue execution, and two more tokens will survive, but only the initial thread can use the more powerful initial token. Target's responsibility is to destroy the initial token after the preparation is complete. This is achieved by this simple call:

After target declares this call, the only token available is the lock token, and the full sandbox restriction takes effect. This call cannot be undone. Note that the initial token is an impersonation token, which is valid only for the main thread, and other threads created by the target process only use the lock token, so no attempt is made to obtain any system resources that require security checks.

The fact that targeting starts with a privilege token simplifies explicit policy, because anything privilege-related that needs to be done once at the time the process starts can be done before the LowerToken() call, and there is no need to set rules in the policy.

> **significant**
> 
> Make sure that any sensitive operating system handles obtained by the initial token are closed before calling LowerToken(). Any compromised handle could be exploited by malware to escape the sandbox.

## References  
\[01\] Richter, Jeffrey "Make Your Windows 2000 Processes Play Nice Together With Job Kernel Objects"

[http://www.microsoft.com/msj/0399/jobkernelobj/jobkernelobj.aspx](http://www.microsoft.com/msj/0399/jobkernelobj/jobkernelobj.aspx)

\[02\] Brown, Keith "What Is a Token" (wiki)

[http://alt.pluralsight.com/wiki/default.aspx/Keith.GuideBook/WhatIsA token .htm](http://alt.pluralsight.com/wiki/default.aspx/Keith.GuideBook/WhatIsA%E4%BB%A4%E7%89%8C.htm)

\[03\] Windows Integrity Mechanism Design (MSDN)

[http://msdn.microsoft.com/en-us/library/bb625963.aspx](http://msdn.microsoft.com/en-us/library/bb625963.aspx)
